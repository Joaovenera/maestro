package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/venerahost/maestro/internal/repository"
)

type AuthHandler struct {
	authRepo   *repository.AuthRepo
	clientRepo *repository.ClientRepo
}

func NewAuthHandler(ar *repository.AuthRepo, cr *repository.ClientRepo) *AuthHandler {
	return &AuthHandler{authRepo: ar, clientRepo: cr}
}

// POST /api/v1/admin/api-keys — criar nova API key (requer key admin existente)
func (h *AuthHandler) CreateAPIKey(c echo.Context) error {
	var req struct {
		Name        string `json:"name" validate:"required"`
		Permissions string `json:"permissions"` // "admin" | "read"
		ExpiresInDays int  `json:"expires_in_days"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if req.Permissions == "" {
		req.Permissions = "admin"
	}
	var expiresAt *time.Time
	if req.ExpiresInDays > 0 {
		t := time.Now().AddDate(0, 0, req.ExpiresInDays)
		expiresAt = &t
	}
	rawKey, keyModel, err := h.authRepo.GenerateAPIKey(c.Request().Context(), req.Name, req.Permissions, expiresAt)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, map[string]any{
		"key":    rawKey,   // retornado APENAS UMA VEZ — salvar agora
		"id":     keyModel.ID,
		"name":   keyModel.Name,
		"prefix": keyModel.KeyPrefix,
		"note":   "Store this key securely — it will not be shown again.",
	})
}

// GET /api/v1/admin/api-keys — listar keys (sem os hashes)
func (h *AuthHandler) ListAPIKeys(c echo.Context) error {
	keys, err := h.authRepo.ListAPIKeys(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, keys)
}

// DELETE /api/v1/admin/api-keys/:id — revogar key
func (h *AuthHandler) DeleteAPIKey(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	if err := h.authRepo.DeleteAPIKey(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// POST /api/v1/clients/:id/token — gerar token para o portal do cliente (admin only)
func (h *AuthHandler) CreateClientToken(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var req struct {
		TTLHours int `json:"ttl_hours"` // padrão 24h
	}
	_ = c.Bind(&req)
	ttl := time.Duration(req.TTLHours) * time.Hour
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}

	token, session, err := h.authRepo.CreateClientSession(c.Request().Context(), id, ttl)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, map[string]any{
		"token":      token,
		"expires_at": session.ExpiresAt,
		"note":       "Send this token to the client. It expires in the specified TTL.",
	})
}

// POST /api/v1/auth/logout — revogar token do portal
func (h *AuthHandler) Logout(c echo.Context) error {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.Bind(&req); err != nil || req.Token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "token required")
	}
	_ = h.authRepo.RevokeClientSession(c.Request().Context(), req.Token)
	return c.JSON(http.StatusOK, map[string]string{"status": "logged out"})
}
