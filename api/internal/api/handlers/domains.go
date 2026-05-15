package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

type DomainHandler struct {
	domainRepo *repository.DomainRepo
	enqueuer   *tasks.Enqueuer
}

func NewDomainHandler(dr *repository.DomainRepo, e *tasks.Enqueuer) *DomainHandler {
	return &DomainHandler{domainRepo: dr, enqueuer: e}
}

func (h *DomainHandler) Create(c echo.Context) error {
	var req struct {
		ClientID   string `json:"client_id" validate:"required"`
		Hostname   string `json:"hostname" validate:"required"`
		SSLEnabled bool   `json:"ssl_enabled"`
	}
	req.SSLEnabled = true // default
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid client_id")
	}
	d, err := h.domainRepo.Create(c.Request().Context(), clientID, req.Hostname, req.SSLEnabled)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, d)
}

func (h *DomainHandler) List(c echo.Context) error {
	clientIDStr := c.QueryParam("client_id")
	if clientIDStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "client_id required")
	}
	clientID, err := uuid.Parse(clientIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid client_id")
	}
	domains, err := h.domainRepo.ListByClient(c.Request().Context(), clientID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, domains)
}

func (h *DomainHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	d, err := h.domainRepo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "domain not found")
	}
	return c.JSON(http.StatusOK, d)
}

func (h *DomainHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	ctx := c.Request().Context()
	d, err := h.domainRepo.GetByID(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "domain not found")
	}
	if err := h.domainRepo.Delete(ctx, id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	// Sync FQDN if domain was assigned
	if d.ServiceID != nil {
		_ = h.enqueuer.SyncDomain(ctx, d.ServiceID.String())
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *DomainHandler) Assign(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var req struct {
		ServiceID string `json:"service_id" validate:"required"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	serviceID, err := uuid.Parse(req.ServiceID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid service_id")
	}
	ctx := c.Request().Context()
	if err := h.domainRepo.Assign(ctx, id, serviceID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := h.enqueuer.SyncDomain(ctx, req.ServiceID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "enqueue domain sync failed: "+err.Error())
	}
	d, _ := h.domainRepo.GetByID(ctx, id)
	return c.JSON(http.StatusOK, d)
}

func (h *DomainHandler) Unassign(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	ctx := c.Request().Context()
	d, err := h.domainRepo.GetByID(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "domain not found")
	}
	prevServiceID := d.ServiceID
	if err := h.domainRepo.Unassign(ctx, id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if prevServiceID != nil {
		_ = h.enqueuer.SyncDomain(ctx, prevServiceID.String())
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "unassigned"})
}
