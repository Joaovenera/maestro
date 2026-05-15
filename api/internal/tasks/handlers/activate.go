package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/models"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

type ActivateHandler struct {
	coolify     *coolify.Client
	serviceRepo *repository.ServiceRepo
}

func NewActivateHandler(c *coolify.Client, sr *repository.ServiceRepo) *ActivateHandler {
	return &ActivateHandler{coolify: c, serviceRepo: sr}
}

func (h *ActivateHandler) Handle(ctx context.Context, t *asynq.Task) error {
	var p tasks.ClientPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return err
	}
	clientID, err := uuid.Parse(p.ClientID)
	if err != nil {
		return err
	}

	svcs, err := h.serviceRepo.ListByClient(ctx, clientID)
	if err != nil {
		return fmt.Errorf("list services: %w", err)
	}

	var lastErr error
	for _, svc := range svcs {
		if strings.Contains(svc.CoolifyApplicationUUID, "-") {
			slog.Debug("activate: skipping infra service component", "service_id", svc.ID, "uuid", svc.CoolifyApplicationUUID)
			continue
		}
		if err := h.coolify.StartApplication(ctx, svc.CoolifyApplicationUUID); err != nil {
			slog.Error("start application failed", "service_id", svc.ID, "err", err)
			lastErr = err
			continue
		}
		_ = h.serviceRepo.UpdateStatus(ctx, svc.ID, models.ServiceStatusRunning)
		slog.Info("service started", "service_id", svc.ID, "client_id", clientID)
	}
	return lastErr
}
