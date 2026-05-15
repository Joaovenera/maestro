package workers

import (
	"context"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/models"
	"github.com/venerahost/maestro/internal/repository"
)

type HardwareCollector struct {
	coolify     *coolify.Client
	serviceRepo *repository.ServiceRepo
	metricsRepo *repository.MetricsRepo
}

func NewHardwareCollector(c *coolify.Client, sr *repository.ServiceRepo, mr *repository.MetricsRepo) *HardwareCollector {
	return &HardwareCollector{coolify: c, serviceRepo: sr, metricsRepo: mr}
}

func (h *HardwareCollector) Run(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.collect(ctx)
		}
	}
}

func (h *HardwareCollector) collect(ctx context.Context) {
	svcs, err := h.serviceRepo.ListAll(ctx)
	if err != nil {
		slog.Error("hardware collector: list services", "err", err)
		return
	}

	// Group by server to minimize Coolify API calls
	byServer := make(map[string][]*models.Service)
	for _, svc := range svcs {
		if svc.CoolifyServerUUID != "" {
			byServer[svc.CoolifyServerUUID] = append(byServer[svc.CoolifyServerUUID], svc)
		}
	}

	for serverUUID, serverSvcs := range byServer {
		resources, err := h.coolify.GetServerResources(ctx, serverUUID)
		if err != nil {
			slog.Error("get server resources", "server", serverUUID, "err", err)
			continue
		}

		// Map Coolify resource uuid → metric
		resourceMap := make(map[string]coolify.Resource)
		for _, r := range resources {
			resourceMap[r.UUID] = r
		}

		now := time.Now()
		for _, svc := range serverSvcs {
			res, ok := resourceMap[svc.CoolifyApplicationUUID]
			if !ok {
				continue
			}

			// Update status if changed
			newStatus := coolifyStatusToInternal(res.Status)
			if newStatus != svc.Status {
				_ = h.serviceRepo.UpdateStatus(ctx, svc.ID, newStatus)
			}

			// Coolify returns CPU/RAM as strings in resource list
			// Parse best-effort from status field for now
			metric := &models.HardwareMetric{
				Time:      now,
				ServiceID: svc.ID,
				CPUPct:    parseCPU(res.Status),
				RAMMB:     0,
			}
			if err := h.metricsRepo.InsertHardware(ctx, metric); err != nil {
				slog.Error("insert hardware metric", "service_id", svc.ID, "err", err)
			}
		}
	}
}

func coolifyStatusToInternal(status string) models.ServiceStatus {
	s := strings.ToLower(status)
	switch {
	case strings.Contains(s, "running"):
		return models.ServiceStatusRunning
	case strings.Contains(s, "exited"), strings.Contains(s, "stopped"):
		return models.ServiceStatusStopped
	case strings.Contains(s, "error"), strings.Contains(s, "unhealthy"):
		return models.ServiceStatusError
	default:
		return models.ServiceStatusUnknown
	}
}

func parseCPU(status string) float64 {
	// Status may contain CPU% in some Coolify versions
	if idx := strings.Index(status, "cpu:"); idx >= 0 {
		rest := status[idx+4:]
		rest = strings.TrimSpace(strings.Split(rest, " ")[0])
		rest = strings.TrimSuffix(rest, "%")
		if v, err := strconv.ParseFloat(rest, 64); err == nil {
			return v
		}
	}
	return 0
}
