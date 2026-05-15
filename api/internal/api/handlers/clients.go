package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/models"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

type ClientHandler struct {
	repo     *repository.ClientRepo
	enqueuer *tasks.Enqueuer
}

func NewClientHandler(r *repository.ClientRepo, e *tasks.Enqueuer) *ClientHandler {
	return &ClientHandler{repo: r, enqueuer: e}
}

func (h *ClientHandler) Create(c echo.Context) error {
	var req struct {
		Name      string `json:"name" validate:"required"`
		Email     string `json:"email" validate:"required,email"`
		BillingID string `json:"billing_id"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	client, err := h.repo.Create(c.Request().Context(), req.Name, req.Email, req.BillingID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, client)
}

func (h *ClientHandler) List(c echo.Context) error {
	clients, err := h.repo.List(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, clients)
}

func (h *ClientHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	client, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "client not found")
	}
	return c.JSON(http.StatusOK, client)
}

func (h *ClientHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var req struct {
		Name      string `json:"name"`
		Email     string `json:"email"`
		BillingID string `json:"billing_id"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	client, err := h.repo.Update(c.Request().Context(), id, req.Name, req.Email, req.BillingID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, client)
}

func (h *ClientHandler) Suspend(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	ctx := c.Request().Context()
	if err := h.repo.UpdateStatus(ctx, id, models.ClientStatusSuspended); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := h.enqueuer.SuspendClient(ctx, id.String()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "enqueue failed: "+err.Error())
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "suspended", "message": "suspension queued"})
}

func (h *ClientHandler) Activate(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	ctx := c.Request().Context()
	if err := h.repo.UpdateStatus(ctx, id, models.ClientStatusActive); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := h.enqueuer.ActivateClient(ctx, id.String()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "enqueue failed: "+err.Error())
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "active", "message": "activation queued"})
}

func (h *ClientHandler) GetQuota(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	quota, err := h.repo.GetQuotaUsage(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, quota)
}

func (h *ClientHandler) UpdateQuota(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var req struct {
		MaxServices int `json:"max_services"`
		MaxDomains  int `json:"max_domains"`
		MaxRAMMB    int `json:"max_ram_mb"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := h.repo.UpdateQuota(c.Request().Context(), id, req.MaxServices, req.MaxDomains, req.MaxRAMMB); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "updated"})
}
