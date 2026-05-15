package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/robfig/cron/v3"
	"github.com/venerahost/maestro/internal/repository"
)

type ScheduledHandler struct {
	repo *repository.ScheduledRepo
}

func NewScheduledHandler(r *repository.ScheduledRepo) *ScheduledHandler {
	return &ScheduledHandler{repo: r}
}

func (h *ScheduledHandler) Create(c echo.Context) error {
	var req struct {
		ServiceID string `json:"service_id" validate:"required"`
		CronExpr  string `json:"cron_expr" validate:"required"`
		Force     bool   `json:"force"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if _, err := cron.ParseStandard(req.CronExpr); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid cron expression: "+err.Error())
	}
	serviceID, err := uuid.Parse(req.ServiceID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid service_id")
	}
	sd, err := h.repo.Create(c.Request().Context(), serviceID, req.CronExpr, req.Force)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, sd)
}

func (h *ScheduledHandler) List(c echo.Context) error {
	serviceIDStr := c.QueryParam("service_id")
	if serviceIDStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "service_id required")
	}
	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid service_id")
	}
	list, err := h.repo.ListByService(c.Request().Context(), serviceID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, list)
}

func (h *ScheduledHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var req struct {
		CronExpr string `json:"cron_expr"`
		Force    bool   `json:"force"`
		Enabled  bool   `json:"enabled"`
	}
	req.Enabled = true
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if req.CronExpr != "" {
		if _, err := cron.ParseStandard(req.CronExpr); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid cron expression")
		}
	}
	sd, err := h.repo.Update(c.Request().Context(), id, req.CronExpr, req.Force, req.Enabled)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, sd)
}

func (h *ScheduledHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
