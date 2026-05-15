package workers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/venerahost/maestro/internal/models"
	"github.com/venerahost/maestro/internal/repository"
)

type UptimeChecker struct {
	domainRepo  *repository.DomainRepo
	metricsRepo *repository.MetricsRepo
	httpClient  *http.Client
}

func NewUptimeChecker(dr *repository.DomainRepo, mr *repository.MetricsRepo) *UptimeChecker {
	return &UptimeChecker{
		domainRepo:  dr,
		metricsRepo: mr,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 3 {
					return http.ErrUseLastResponse
				}
				return nil
			},
		},
	}
}

func (u *UptimeChecker) Run(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			u.check(ctx)
		}
	}
}

func (u *UptimeChecker) check(ctx context.Context) {
	domains, err := u.domainRepo.ListAssignedActive(ctx)
	if err != nil {
		slog.Error("uptime checker: list domains", "err", err)
		return
	}

	for _, d := range domains {
		if d.ServiceID == nil {
			continue
		}
		go u.ping(ctx, d)
	}
}

func (u *UptimeChecker) ping(ctx context.Context, d *models.Domain) {
	scheme := "http"
	if d.SSLEnabled {
		scheme = "https"
	}
	url := scheme + "://" + d.Hostname

	start := time.Now()
	resp, err := u.httpClient.Get(url)
	latency := int(time.Since(start).Milliseconds())

	record := &models.UptimeRecord{
		Time:      time.Now(),
		DomainID:  d.ID,
		ServiceID: *d.ServiceID,
		LatencyMS: latency,
		IsUp:      false,
	}

	if err != nil {
		slog.Debug("uptime ping failed", "domain", d.Hostname, "err", err)
	} else {
		defer resp.Body.Close()
		record.StatusCode = resp.StatusCode
		record.IsUp = resp.StatusCode < 500
	}

	if err := u.metricsRepo.InsertUptime(context.Background(), record); err != nil {
		slog.Error("insert uptime record", "domain_id", d.ID, "err", err)
	}
}
