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

type DeployHandler struct {
	coolify     *coolify.Client
	serviceRepo *repository.ServiceRepo
	deployRepo  *repository.DeployRepo
}

func NewDeployHandler(c *coolify.Client, sr *repository.ServiceRepo, dr *repository.DeployRepo) *DeployHandler {
	return &DeployHandler{coolify: c, serviceRepo: sr, deployRepo: dr}
}

func (h *DeployHandler) Handle(ctx context.Context, t *asynq.Task) error {
	var p tasks.ServicePayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return err
	}
	serviceID, err := uuid.Parse(p.ServiceID)
	if err != nil {
		return err
	}

	svc, err := h.serviceRepo.GetByID(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("get service: %w", err)
	}

	_ = h.serviceRepo.UpdateStatus(ctx, serviceID, models.ServiceStatusDeploying)

	resp, err := h.coolify.Deploy(ctx, svc.CoolifyApplicationUUID, p.Force)
	if err != nil {
		if p.DeployID != "" {
			if id, parseErr := uuid.Parse(p.DeployID); parseErr == nil {
				_ = h.deployRepo.UpdateStatus(ctx, id, models.DeployStatusFailed, "")
			}
		}
		return fmt.Errorf("coolify deploy: %w", err)
	}

	if p.DeployID != "" {
		if id, parseErr := uuid.Parse(p.DeployID); parseErr == nil {
			_ = h.deployRepo.UpdateStatus(ctx, id, models.DeployStatusRunning, resp.DeploymentUUID)
		}
	}

	slog.Info("deploy triggered", "service_id", serviceID, "coolify_deploy_uuid", resp.DeploymentUUID)
	return nil
}
