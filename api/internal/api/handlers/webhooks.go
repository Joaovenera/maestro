package handlers

import (
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/models"
	"github.com/venerahost/maestro/internal/repository"
)

type WebhookHandler struct {
	serviceRepo *repository.ServiceRepo
	deployRepo  *repository.DeployRepo
	secret      string
}

func NewWebhookHandler(sr *repository.ServiceRepo, dr *repository.DeployRepo, secret string) *WebhookHandler {
	return &WebhookHandler{serviceRepo: sr, deployRepo: dr, secret: secret}
}

func (h *WebhookHandler) HandleCoolify(c echo.Context) error {
	if h.secret != "" {
		// Aceita o secret via header (futuro) OU query param ?token= (Coolify)
		token := c.Request().Header.Get("X-Coolify-Token")
		if token == "" {
			token = c.QueryParam("token")
		}
		if token != h.secret {
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
		}
	}

	// Payload real do Coolify (fonte: WebhookChannel.php + Notification classes)
	var payload struct {
		Event           string `json:"event"`            // deployment_success | deployment_failed | server_unreachable
		Success         bool   `json:"success"`
		ApplicationUUID string `json:"application_uuid"` // UUID do app no Coolify
		DeploymentUUID  string `json:"deployment_uuid"`
		ServerUUID      string `json:"server_uuid"`
		ApplicationName string `json:"application_name"`
		ServerName      string `json:"server_name"`
		FQDN            string `json:"fqdn"`
	}
	if err := c.Bind(&payload); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	ctx := c.Request().Context()
	slog.Info("coolify webhook received",
		"event", payload.Event,
		"application_uuid", payload.ApplicationUUID,
		"deployment_uuid", payload.DeploymentUUID,
		"success", payload.Success,
	)

	switch payload.Event {
	case "deployment_success":
		if payload.DeploymentUUID != "" {
			_ = h.deployRepo.UpdateStatusByCoolifyUUID(ctx, payload.DeploymentUUID, models.DeployStatusSuccess)
		}
		if payload.ApplicationUUID != "" {
			_ = h.serviceRepo.UpdateStatusByCoolifyUUID(ctx, payload.ApplicationUUID, models.ServiceStatusRunning)
		}

	case "deployment_failed":
		if payload.DeploymentUUID != "" {
			_ = h.deployRepo.UpdateStatusByCoolifyUUID(ctx, payload.DeploymentUUID, models.DeployStatusFailed)
		}
		if payload.ApplicationUUID != "" {
			_ = h.serviceRepo.UpdateStatusByCoolifyUUID(ctx, payload.ApplicationUUID, models.ServiceStatusError)
		}

	case "server_unreachable":
		if payload.ServerUUID != "" {
			_ = h.serviceRepo.UpdateStatusByServerUUID(ctx, payload.ServerUUID, models.ServiceStatusUnreachable)
		}
		slog.Warn("server unreachable", "server_uuid", payload.ServerUUID, "server_name", payload.ServerName)

	case "server_reachable":
		slog.Info("server reachable again", "server_uuid", payload.ServerUUID)
		// status syncer reconcilia no próximo tick

	default:
		slog.Debug("unhandled coolify webhook event", "event", payload.Event)
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "processed", "event": payload.Event})
}
