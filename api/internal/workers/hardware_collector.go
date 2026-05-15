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
	sentinel    *coolify.SentinelClient
	coolify     *coolify.Client
	serviceRepo *repository.ServiceRepo
	metricsRepo *repository.MetricsRepo
}

func NewHardwareCollector(
	sentinel *coolify.SentinelClient,
	c *coolify.Client,
	sr *repository.ServiceRepo,
	mr *repository.MetricsRepo,
) *HardwareCollector {
	return &HardwareCollector{
		sentinel:    sentinel,
		coolify:     c,
		serviceRepo: sr,
		metricsRepo: mr,
	}
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
	if h.sentinel == nil {
		slog.Debug("hardware collector: sentinel not configured, skipping")
		return
	}

	svcs, err := h.serviceRepo.ListAll(ctx)
	if err != nil {
		slog.Error("hardware collector: list services", "err", err)
		return
	}

	// Ask sentinel for data from the last 30s to get the most recent sample.
	from := time.Now().Add(-30 * time.Second)
	now := time.Now()
	matched := 0

	for _, svc := range svcs {
		if svc.CoolifyApplicationUUID == "" {
			continue
		}

		cpu, err := h.sentinel.GetLatestCPU(ctx, svc.CoolifyApplicationUUID, from)
		if err != nil {
			slog.Debug("hardware collector: cpu fetch", "service", svc.ID, "err", err)
			continue
		}
		if cpu == nil {
			continue
		}

		cpuPct, _ := strconv.ParseFloat(cpu.Percent, 64)

		var ramMB int
		mem, err := h.sentinel.GetLatestMemory(ctx, svc.CoolifyApplicationUUID, from)
		if err == nil && mem != nil {
			ramMB = int(mem.Used) // sentinel reports used in MB
		}

		metric := &models.HardwareMetric{
			Time:      now,
			ServiceID: svc.ID,
			CPUPct:    cpuPct,
			RAMMB:     ramMB,
		}
		if err := h.metricsRepo.InsertHardware(ctx, metric); err != nil {
			slog.Error("hardware collector: insert metric", "service_id", svc.ID, "err", err)
			continue
		}
		matched++
	}

	slog.Debug("hardware collector: cycle complete", "services", len(svcs), "matched", matched)
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
