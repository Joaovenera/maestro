package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/repository"
)

type DeployHistoryHandler struct {
	repo *repository.DeployRepo
}

func NewDeployHistoryHandler(r *repository.DeployRepo) *DeployHistoryHandler {
	return &DeployHistoryHandler{repo: r}
}

func (h *DeployHistoryHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	d, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "deploy not found")
	}
	return c.JSON(http.StatusOK, d)
}
