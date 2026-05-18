package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/models"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

const (
	deployPollInterval = 10 * time.Second
	deployTimeout      = 10 * time.Minute
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
		_ = h.serviceRepo.UpdateStatus(ctx, serviceID, models.ServiceStatusError)
		return fmt.Errorf("coolify deploy: %w", err)
	}

	var deployID uuid.UUID
	if p.DeployID != "" {
		if id, parseErr := uuid.Parse(p.DeployID); parseErr == nil {
			deployID = id
			_ = h.deployRepo.UpdateStatus(ctx, id, models.DeployStatusRunning, resp.DeploymentUUID)
		}
	}

	slog.Info("deploy triggered", "service_id", serviceID, "coolify_deploy_uuid", resp.DeploymentUUID)

	if resp.DeploymentUUID == "" {
		return nil
	}
	return h.pollUntilComplete(ctx, serviceID, deployID, resp.DeploymentUUID)
}

func (h *DeployHandler) pollUntilComplete(ctx context.Context, serviceID, deployID uuid.UUID, coolifyUUID string) error {
	pollCtx, cancel := context.WithTimeout(ctx, deployTimeout)
	defer cancel()

	ticker := time.NewTicker(deployPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-pollCtx.Done():
			slog.Warn("deploy poll timeout", "service_id", serviceID, "coolify_uuid", coolifyUUID)
			if deployID != uuid.Nil {
				_ = h.deployRepo.UpdateStatus(ctx, deployID, models.DeployStatusFailed, coolifyUUID)
			}
			_ = h.serviceRepo.UpdateStatus(ctx, serviceID, models.ServiceStatusError)
			return asynq.SkipRetry // timeout não é erro transitório
		case <-ticker.C:
			d, err := h.coolify.GetDeployment(pollCtx, coolifyUUID)
			if err != nil {
				slog.Warn("poll deployment status", "service_id", serviceID, "err", err)
				continue
			}
			switch d.Status {
			case "finished":
				if deployID != uuid.Nil {
					_ = h.deployRepo.UpdateStatus(ctx, deployID, models.DeployStatusSuccess, coolifyUUID)
				}
				_ = h.serviceRepo.UpdateStatus(ctx, serviceID, models.ServiceStatusRunning)
				slog.Info("deploy finished", "service_id", serviceID, "coolify_uuid", coolifyUUID)
				return nil
			case "failed", "error", "cancelled":
				if deployID != uuid.Nil {
					_ = h.deployRepo.UpdateStatus(ctx, deployID, models.DeployStatusFailed, coolifyUUID)
				}
				_ = h.serviceRepo.UpdateStatus(ctx, serviceID, models.ServiceStatusError)
				slog.Error("deploy failed", "service_id", serviceID, "coolify_status", d.Status)
				return asynq.SkipRetry // falha real, não tentar novamente
			default:
				slog.Debug("deploy in progress", "service_id", serviceID, "coolify_status", d.Status)
			}
		}
	}
}
