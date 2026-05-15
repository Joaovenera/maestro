package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"
	"github.com/venerahost/maestro/internal/config"
	"github.com/venerahost/maestro/internal/coolify"
	"github.com/venerahost/maestro/internal/database"
	"github.com/venerahost/maestro/internal/repository"
	taskhandlers "github.com/venerahost/maestro/internal/tasks/handlers"
	"github.com/venerahost/maestro/internal/tasks"
	"github.com/venerahost/maestro/internal/workers"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

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

	coolifyClient := coolify.New(cfg.CoolifyBaseURL, cfg.CoolifyAPIKey)

	var sentinelClient *coolify.SentinelClient
	if cfg.SentinelBaseURL != "" {
		sentinelClient = coolify.NewSentinelClient(cfg.SentinelBaseURL, cfg.SentinelToken)
		slog.Info("sentinel configured", "url", cfg.SentinelBaseURL)
	} else {
		slog.Warn("SENTINEL_BASE_URL not set — hardware metrics collection disabled")
	}

	// Repos
	serviceRepo := repository.NewServiceRepo(pool)
	domainRepo := repository.NewDomainRepo(pool)
	deployRepo := repository.NewDeployRepo(pool)
	metricsRepo := repository.NewMetricsRepo(pool)
	scheduledRepo := repository.NewScheduledRepo(pool)

	// Asynq server
	srv := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: 10,
		Queues: map[string]int{
			"critical": 6,
			"default":  3,
			"low":      1,
		},
	})

	mux := asynq.NewServeMux()
	mux.HandleFunc(tasks.TaskClientSuspend,
		taskhandlers.NewSuspendHandler(coolifyClient, serviceRepo).Handle)
	mux.HandleFunc(tasks.TaskClientActivate,
		taskhandlers.NewActivateHandler(coolifyClient, serviceRepo).Handle)
	mux.HandleFunc(tasks.TaskServiceDeploy,
		taskhandlers.NewDeployHandler(coolifyClient, serviceRepo, deployRepo).Handle)
	mux.HandleFunc(tasks.TaskDomainSync,
		taskhandlers.NewDomainSyncHandler(coolifyClient, serviceRepo, domainRepo).Handle)

	// Asynq scheduler for scheduled deploys
	scheduler := asynq.NewScheduler(redisOpt, nil)
	enqueuer := tasks.NewEnqueuer(redisOpt)
	defer enqueuer.Close()

	scheduledList, _ := scheduledRepo.ListEnabled(ctx)
	for _, sd := range scheduledList {
		t, _ := tasks.NewServiceDeployTask(sd.ServiceID.String(), "", "scheduled", sd.Force)
		if _, err := scheduler.Register(sd.CronExpr, t); err != nil {
			slog.Error("register scheduled deploy", "id", sd.ID, "err", err)
		}
	}

	// Background workers
	go workers.NewHardwareCollector(sentinelClient, coolifyClient, serviceRepo, metricsRepo).Run(ctx)
	go workers.NewUptimeChecker(domainRepo, metricsRepo).Run(ctx)
	go workers.NewStatusSyncer(coolifyClient, serviceRepo).Run(ctx)

	go func() {
		if err := scheduler.Run(); err != nil {
			slog.Error("scheduler error", "err", err)
		}
	}()

	slog.Info("maestro-worker starting")
	go func() {
		if err := srv.Run(mux); err != nil {
			slog.Error("asynq server error", "err", err)
			cancel()
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	cancel()
	srv.Shutdown()
	scheduler.Shutdown()
	slog.Info("maestro-worker stopped")
}
