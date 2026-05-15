package workers

import (
	"context"
	"log/slog"
	"time"

	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/repository"
)

type StatusSyncer struct {
	coolify     *coolify.Client
	serviceRepo *repository.ServiceRepo
}

func NewStatusSyncer(c *coolify.Client, sr *repository.ServiceRepo) *StatusSyncer {
	return &StatusSyncer{coolify: c, serviceRepo: sr}
}

func (s *StatusSyncer) Run(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.sync(ctx)
		}
	}
}

func (s *StatusSyncer) sync(ctx context.Context) {
	svcs, err := s.serviceRepo.ListAll(ctx)
	if err != nil {
		slog.Error("status syncer: list services", "err", err)
		return
	}
	for _, svc := range svcs {
		app, err := s.coolify.GetApplication(ctx, svc.CoolifyApplicationUUID)
		if err != nil {
			slog.Debug("status syncer: get application", "service_id", svc.ID, "err", err)
			continue
		}
		newStatus := coolifyStatusToInternal(app.Status)
		if newStatus != svc.Status {
			_ = s.serviceRepo.UpdateStatus(ctx, svc.ID, newStatus)
			slog.Info("service status synced", "service_id", svc.ID, "old", svc.Status, "new", newStatus)
		}
	}
}
