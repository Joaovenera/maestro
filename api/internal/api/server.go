package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/venerahost/maestro/internal/api/handlers"
	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
)

type Server struct {
	echo *echo.Echo
}

type Repos struct {
	Client    *repository.ClientRepo
	Service   *repository.ServiceRepo
	Domain    *repository.DomainRepo
	Deploy    *repository.DeployRepo
	Metrics   *repository.MetricsRepo
	Scheduled *repository.ScheduledRepo
	Auth      *repository.AuthRepo
}

func NewServer(repos *Repos, enqueuer *tasks.Enqueuer, coolifyClient *coolify.Client, webhookSecret string) *Server {
	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())
	e.Use(RateLimiter())

	// Public: health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Public: webhook receiver (auth via secret header, not Bearer)
	wh := handlers.NewWebhookHandler(repos.Service, repos.Deploy, webhookSecret)
	e.POST("/webhooks/coolify", wh.HandleCoolify)

	// Auth utils (público: logout)
	ah := handlers.NewAuthHandler(repos.Auth, repos.Client)
	e.POST("/api/v1/auth/logout", ah.Logout)

	// ── Admin routes (requer API key) ────────────────────────────────────────
	admin := e.Group("/api/v1", AdminAuth(repos.Auth))

	// API key management
	admin.POST("/admin/api-keys", ah.CreateAPIKey)
	admin.GET("/admin/api-keys", ah.ListAPIKeys)
	admin.DELETE("/admin/api-keys/:id", ah.DeleteAPIKey)

	// Geração de token para portal do cliente
	admin.POST("/clients/:id/token", ah.CreateClientToken)

	// Clients (admin)
	ch := handlers.NewClientHandler(repos.Client, enqueuer)
	admin.POST("/clients", ch.Create)
	admin.GET("/clients", ch.List)
	admin.GET("/clients/:id", ch.Get)
	admin.PATCH("/clients/:id", ch.Update)
	admin.POST("/clients/:id/suspend", ch.Suspend)
	admin.POST("/clients/:id/activate", ch.Activate)
	admin.GET("/clients/:id/quota", ch.GetQuota)
	admin.PATCH("/clients/:id/quota", ch.UpdateQuota)

	// Domains (admin)
	dh := handlers.NewDomainHandler(repos.Domain, enqueuer)
	admin.POST("/domains", dh.Create)
	admin.GET("/domains", dh.List)
	admin.GET("/domains/:id", dh.Get)
	admin.DELETE("/domains/:id", dh.Delete)
	admin.PATCH("/domains/:id/assign", dh.Assign)
	admin.PATCH("/domains/:id/unassign", dh.Unassign)

	// Services (admin)
	sh := handlers.NewServiceHandler(repos.Service, repos.Domain, repos.Deploy, enqueuer)
	admin.POST("/services", sh.Create)
	admin.GET("/services", sh.List)
	admin.GET("/services/:id", sh.Get)
	admin.GET("/services/:id/domains", sh.GetDomains)
	admin.POST("/services/:id/deploy", sh.Deploy)
	admin.POST("/services/:id/stop", sh.Stop)
	admin.POST("/services/:id/start", sh.Start)
	admin.GET("/services/:id/deploys", sh.ListDeploys)

	// Deploy history (admin)
	dep := handlers.NewDeployHistoryHandler(repos.Deploy)
	admin.GET("/deploys/:id", dep.Get)

	// Scheduled deploys (admin)
	sched := handlers.NewScheduledHandler(repos.Scheduled)
	admin.POST("/scheduled-deploys", sched.Create)
	admin.GET("/scheduled-deploys", sched.List)
	admin.PATCH("/scheduled-deploys/:id", sched.Update)
	admin.DELETE("/scheduled-deploys/:id", sched.Delete)

	// Metrics (admin)
	mh := handlers.NewMetricsHandler(repos.Metrics, repos.Client)
	admin.GET("/metrics/hardware/:id", mh.Hardware)
	admin.GET("/metrics/uptime/:id", mh.Uptime)
	admin.GET("/metrics/sla/:client_id", mh.SLA)

	// ── Portal routes (requer token de cliente) ──────────────────────────────
	portal := e.Group("/portal", ClientAuth(repos.Auth))
	ph := handlers.NewPortalHandler(repos.Client, repos.Service, repos.Domain, repos.Deploy, repos.Metrics)
	portal.GET("/me", ph.Me)
	portal.GET("/services", ph.Services)
	portal.GET("/domains", ph.Domains)
	portal.GET("/quota", ph.Quota)
	portal.GET("/services/:id/deploys", ph.ServiceDeploys)
	portal.GET("/metrics/sla", ph.SLA)
	portal.GET("/metrics/uptime/:domain_id", ph.Uptime)

	return &Server{echo: e}
}

func (s *Server) Start(port string) error {
	return s.echo.Start(fmt.Sprintf(":%s", port))
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.echo.Shutdown(ctx)
}
