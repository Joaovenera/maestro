package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

type ServiceHandler struct {
	serviceRepo *repository.ServiceRepo
	domainRepo  *repository.DomainRepo
	deployRepo  *repository.DeployRepo
	enqueuer    *tasks.Enqueuer
}

func NewServiceHandler(sr *repository.ServiceRepo, dr *repository.DomainRepo, dep *repository.DeployRepo, e *tasks.Enqueuer) *ServiceHandler {
	return &ServiceHandler{serviceRepo: sr, domainRepo: dr, deployRepo: dep, enqueuer: e}
}

func (h *ServiceHandler) Create(c echo.Context) error {
	var req struct {
		ClientID               string `json:"client_id" validate:"required"`
		Name                   string `json:"name" validate:"required"`
		Type                   string `json:"type" validate:"required"`
		CoolifyApplicationUUID string `json:"coolify_application_uuid" validate:"required"`
		CoolifyServerUUID      string `json:"coolify_server_uuid"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid client_id")
	}
	svc, err := h.serviceRepo.Create(c.Request().Context(), clientID, req.Name, req.Type, req.CoolifyApplicationUUID, req.CoolifyServerUUID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, svc)
}

func (h *ServiceHandler) List(c echo.Context) error {
	if clientIDStr := c.QueryParam("client_id"); clientIDStr != "" {
		clientID, err := uuid.Parse(clientIDStr)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid client_id")
		}
		svcs, err := h.serviceRepo.ListByClient(c.Request().Context(), clientID)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, svcs)
	}
	svcs, err := h.serviceRepo.ListAll(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, svcs)
}

func (h *ServiceHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	svc, err := h.serviceRepo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "service not found")
	}
	return c.JSON(http.StatusOK, svc)
}

func (h *ServiceHandler) GetDomains(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	domains, err := h.domainRepo.ListByService(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, domains)
}

func (h *ServiceHandler) Deploy(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var req struct {
		Force bool `json:"force"`
	}
	_ = c.Bind(&req)

	ctx := c.Request().Context()
	deploy, err := h.deployRepo.Create(ctx, id, "api")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := h.enqueuer.DeployService(ctx, id.String(), deploy.ID.String(), "api", req.Force); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "enqueue failed: "+err.Error())
	}
	return c.JSON(http.StatusAccepted, map[string]any{"deploy_id": deploy.ID, "status": "queued"})
}

func (h *ServiceHandler) Stop(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	if err := h.enqueuer.StopService(c.Request().Context(), id.String()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusAccepted, map[string]string{"status": "stop queued"})
}

func (h *ServiceHandler) Start(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	if err := h.enqueuer.StartService(c.Request().Context(), id.String()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusAccepted, map[string]string{"status": "start queued"})
}

func (h *ServiceHandler) ListDeploys(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	deploys, err := h.deployRepo.ListByService(c.Request().Context(), id, 50, 0)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, deploys)
}
