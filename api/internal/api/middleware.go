package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
	"github.com/venerahost/maestro/internal/repository"
)

const (
	ctxKeyAPIKey   = "api_key"
	ctxKeyClientID = "client_id"
	ctxKeyRole     = "role"  // "admin" | "client"
)

// RateLimiter returns a per-IP rate limiter middleware.
func RateLimiter() echo.MiddlewareFunc {
	config := middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(
			middleware.RateLimiterMemoryStoreConfig{
				Rate:      rate.Limit(60),  // 60 req/s sustained
				Burst:     120,             // burst de 120
				ExpiresIn: 3 * time.Minute,
			},
		),
		IdentifierExtractor: func(c echo.Context) (string, error) {
			return c.RealIP(), nil
		},
		ErrorHandler: func(c echo.Context, err error) error {
			return echo.NewHTTPError(http.StatusTooManyRequests, "rate limit exceeded")
		},
		DenyHandler: func(c echo.Context, id string, err error) error {
			return echo.NewHTTPError(http.StatusTooManyRequests, "too many requests")
		},
	}
	return middleware.RateLimiterWithConfig(config)
}

// AdminAuth requires a valid admin API key (Bearer mst_...).
func AdminAuth(authRepo *repository.AuthRepo) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			key := extractBearer(c)
			if key == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing api key")
			}
			apiKey, err := authRepo.ValidateAPIKey(c.Request().Context(), key)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired api key")
			}
			c.Set(ctxKeyAPIKey, apiKey)
			c.Set(ctxKeyRole, "admin")
			return next(c)
		}
	}
}

// ClientAuth requires a valid portal session token (Bearer portal_...).
func ClientAuth(authRepo *repository.AuthRepo) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := extractBearer(c)
			if token == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing token")
			}
			clientID, err := authRepo.ValidateClientSession(c.Request().Context(), token)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}
			c.Set(ctxKeyClientID, clientID.String())
			c.Set(ctxKeyRole, "client")
			return next(c)
		}
	}
}

// AnyAuth accepts either an admin key or a client portal token.
func AnyAuth(authRepo *repository.AuthRepo) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := extractBearer(c)
			if token == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing token")
			}
			ctx := c.Request().Context()
			// Try admin key first
			if strings.HasPrefix(token, "mst_") {
				if k, err := authRepo.ValidateAPIKey(ctx, token); err == nil {
					c.Set(ctxKeyAPIKey, k)
					c.Set(ctxKeyRole, "admin")
					return next(c)
				}
			}
			// Try client session
			if clientID, err := authRepo.ValidateClientSession(ctx, token); err == nil {
				c.Set(ctxKeyClientID, clientID.String())
				c.Set(ctxKeyRole, "client")
				return next(c)
			}
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
		}
	}
}

func extractBearer(c echo.Context) string {
	auth := c.Request().Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	// Also accept X-API-Key header
	if k := c.Request().Header.Get("X-API-Key"); k != "" {
		return k
	}
	return ""
}
