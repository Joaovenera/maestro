package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/repository"
)

type MetricsHandler struct {
	metricsRepo *repository.MetricsRepo
	clientRepo  *repository.ClientRepo
}

func NewMetricsHandler(mr *repository.MetricsRepo, cr *repository.ClientRepo) *MetricsHandler {
	return &MetricsHandler{metricsRepo: mr, clientRepo: cr}
}

func (h *MetricsHandler) Hardware(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	from, to := parseTimeRange(c)
	metrics, err := h.metricsRepo.GetHardwareTimeline(c.Request().Context(), id, from, to)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, metrics)
}

func (h *MetricsHandler) Uptime(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	from, to := parseTimeRange(c)
	records, err := h.metricsRepo.GetUptimeHistory(c.Request().Context(), id, from, to)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, records)
}

func (h *MetricsHandler) SLA(c echo.Context) error {
	id, err := uuid.Parse(c.Param("client_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid client_id")
	}
	days := 30
	sla, err := h.metricsRepo.GetSLAByClient(c.Request().Context(), id, days)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]any{
		"client_id": id,
		"days":      days,
		"domains":   sla,
	})
}

func parseTimeRange(c echo.Context) (time.Time, time.Time) {
	to := time.Now()
	from := to.Add(-24 * time.Hour)
	if f := c.QueryParam("from"); f != "" {
		if t, err := time.Parse(time.RFC3339, f); err == nil {
			from = t
		}
	}
	if t := c.QueryParam("to"); t != "" {
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			to = parsed
		}
	}
	return from, to
}
