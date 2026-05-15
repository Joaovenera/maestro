package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/venerahost/maestro/internal/api"
	"github.com/venerahost/maestro/internal/config"
	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/database"
	"github.com/venerahost/maestro/internal/repository"
	"github.com/venerahost/maestro/internal/tasks"
	"github.com/venerahost/maestro/migrations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}

	if err := database.RunMigrations(migrations.FS, cfg.DatabaseURL); err != nil {
		slog.Error("run migrations", "err", err)
		os.Exit(1)
	}

	ctx := context.Background()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("connect postgres", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	redisOpt, err := database.NewRedisOpt(cfg.RedisURL)
	if err != nil {
		slog.Error("parse redis url", "err", err)
		os.Exit(1)
	}

	enqueuer := tasks.NewEnqueuer(redisOpt)
	defer enqueuer.Close()

	coolifyClient := coolify.New(cfg.CoolifyBaseURL, cfg.CoolifyAPIKey)

	repos := &api.Repos{
		Client:    repository.NewClientRepo(pool),
		Service:   repository.NewServiceRepo(pool),
		Domain:    repository.NewDomainRepo(pool),
		Deploy:    repository.NewDeployRepo(pool),
		Metrics:   repository.NewMetricsRepo(pool),
		Scheduled: repository.NewScheduledRepo(pool),
		Auth:      repository.NewAuthRepo(pool),
	}

	srv := api.NewServer(repos, enqueuer, coolifyClient, cfg.WebhookSecret)

	go func() {
		slog.Info("maestro-api starting", "port", cfg.APIPort)
		if err := srv.Start(cfg.APIPort); err != nil {
			slog.Error("server stopped", "err", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
	slog.Info("maestro-api stopped")
}
