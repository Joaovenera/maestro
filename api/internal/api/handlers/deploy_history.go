package handlers

import (
	"net/http"
	"strconv"

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

func (h *DeployHistoryHandler) List(c echo.Context) error {
	limit := 200
	offset := 0
	if v := c.QueryParam("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}
	if v := c.QueryParam("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	deploys, err := h.repo.ListAll(c.Request().Context(), limit, offset, c.QueryParam("status"))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, deploys)
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
