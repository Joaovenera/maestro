package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/repository"
)

// Portal handlers: read-only, scoped to the authenticated client_id.
type PortalHandler struct {
	clientRepo  *repository.ClientRepo
	serviceRepo *repository.ServiceRepo
	domainRepo  *repository.DomainRepo
	deployRepo  *repository.DeployRepo
	metricsRepo *repository.MetricsRepo
}

func NewPortalHandler(cr *repository.ClientRepo, sr *repository.ServiceRepo, dr *repository.DomainRepo, dep *repository.DeployRepo, mr *repository.MetricsRepo) *PortalHandler {
	return &PortalHandler{clientRepo: cr, serviceRepo: sr, domainRepo: dr, deployRepo: dep, metricsRepo: mr}
}

func (h *PortalHandler) clientIDFromCtx(c echo.Context) (uuid.UUID, error) {
	raw, _ := c.Get("client_id").(string)
	return uuid.Parse(raw)
}

// GET /portal/me
func (h *PortalHandler) Me(c echo.Context) error {
	clientID, err := h.clientIDFromCtx(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
	}
	client, err := h.clientRepo.GetByID(c.Request().Context(), clientID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "client not found")
	}
	return c.JSON(http.StatusOK, client)
}

// GET /portal/services
func (h *PortalHandler) Services(c echo.Context) error {
	clientID, err := h.clientIDFromCtx(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
	}
	svcs, err := h.serviceRepo.ListByClient(c.Request().Context(), clientID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, svcs)
}

// GET /portal/domains
func (h *PortalHandler) Domains(c echo.Context) error {
	clientID, err := h.clientIDFromCtx(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
	}
	domains, err := h.domainRepo.ListByClient(c.Request().Context(), clientID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, domains)
}

// GET /portal/services/:id/deploys — cliente vê histórico do próprio serviço
func (h *PortalHandler) ServiceDeploys(c echo.Context) error {
	clientID, err := h.clientIDFromCtx(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
	}
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid service id")
	}
	// Verify service belongs to this client
	svc, err := h.serviceRepo.GetByID(c.Request().Context(), serviceID)
	if err != nil || svc.ClientID != clientID {
		return echo.NewHTTPError(http.StatusForbidden, "access denied")
	}
	deploys, err := h.deployRepo.ListByService(c.Request().Context(), serviceID, 20, 0)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, deploys)
}

// GET /portal/metrics/sla — SLA dos domínios do próprio cliente
func (h *PortalHandler) SLA(c echo.Context) error {
	clientID, err := h.clientIDFromCtx(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
	}
	sla, err := h.metricsRepo.GetSLAByClient(c.Request().Context(), clientID, 30)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]any{
		"client_id": clientID,
		"days":      30,
		"domains":   sla,
	})
}

// GET /portal/metrics/uptime/:domain_id — cliente vê uptime de um domínio próprio
func (h *PortalHandler) Uptime(c echo.Context) error {
	clientID, err := h.clientIDFromCtx(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
	}
	domainID, err := uuid.Parse(c.Param("domain_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid domain_id")
	}
	d, err := h.domainRepo.GetByID(c.Request().Context(), domainID)
	if err != nil || d.ClientID != clientID {
		return echo.NewHTTPError(http.StatusForbidden, "access denied")
	}
	from, to := parseTimeRange(c)
	records, err := h.metricsRepo.GetUptimeHistory(c.Request().Context(), domainID, from, to)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, records)
}

// GET /portal/quota
func (h *PortalHandler) Quota(c echo.Context) error {
	clientID, err := h.clientIDFromCtx(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
	}
	quota, err := h.clientRepo.GetQuotaUsage(c.Request().Context(), clientID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, quota)
}
