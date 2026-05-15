package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

type DomainSyncHandler struct {
	coolify     *coolify.Client
	serviceRepo *repository.ServiceRepo
	domainRepo  *repository.DomainRepo
}

func NewDomainSyncHandler(c *coolify.Client, sr *repository.ServiceRepo, dr *repository.DomainRepo) *DomainSyncHandler {
	return &DomainSyncHandler{coolify: c, serviceRepo: sr, domainRepo: dr}
}

func (h *DomainSyncHandler) Handle(ctx context.Context, t *asynq.Task) error {
	var p tasks.DomainSyncPayload
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

	fqdn, err := h.domainRepo.BuildFQDN(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("build fqdn: %w", err)
	}

	if err := h.coolify.UpdateApplicationFQDN(ctx, svc.CoolifyApplicationUUID, fqdn); err != nil {
		return fmt.Errorf("update fqdn on coolify: %w", err)
	}

	// Mark all domains for this service as verified
	domains, _ := h.domainRepo.ListByService(ctx, serviceID)
	for _, d := range domains {
		_ = h.domainRepo.MarkVerified(ctx, d.ID)
	}

	slog.Info("domain fqdn synced", "service_id", serviceID, "fqdn", fqdn)
	return nil
}
