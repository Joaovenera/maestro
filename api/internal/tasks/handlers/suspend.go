package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/models"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

type SuspendHandler struct {
	coolify     *coolify.Client
	serviceRepo *repository.ServiceRepo
}

func NewSuspendHandler(c *coolify.Client, sr *repository.ServiceRepo) *SuspendHandler {
	return &SuspendHandler{coolify: c, serviceRepo: sr}
}

func (h *SuspendHandler) Handle(ctx context.Context, t *asynq.Task) error {
	var p tasks.ClientPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}
	clientID, err := uuid.Parse(p.ClientID)
	if err != nil {
		return fmt.Errorf("parse client_id: %w", err)
	}

	svcs, err := h.serviceRepo.ListByClient(ctx, clientID)
	if err != nil {
		return fmt.Errorf("list services: %w", err)
	}

	var lastErr error
	for _, svc := range svcs {
		if svc.Status == models.ServiceStatusStopped {
			continue
		}
		if err := h.coolify.StopApplication(ctx, svc.CoolifyApplicationUUID); err != nil {
			slog.Error("stop application failed", "service_id", svc.ID, "err", err)
			lastErr = err
			continue
		}
		_ = h.serviceRepo.UpdateStatus(ctx, svc.ID, models.ServiceStatusStopped)
		slog.Info("service stopped", "service_id", svc.ID, "client_id", clientID)
	}
	return lastErr
}
