package tasks

import (
	"context"
	"fmt"

	"github.com/hibiken/asynq"
)

type Enqueuer struct {
	client *asynq.Client
}

func NewEnqueuer(opt asynq.RedisClientOpt) *Enqueuer {
	return &Enqueuer{client: asynq.NewClient(opt)}
}

func (e *Enqueuer) Close() { e.client.Close() }

func (e *Enqueuer) SuspendClient(ctx context.Context, clientID string) error {
	t, err := NewClientTask(TaskClientSuspend, clientID)
	if err != nil {
		return fmt.Errorf("build task: %w", err)
	}
	_, err = e.client.EnqueueContext(ctx, t)
	return err
}

func (e *Enqueuer) ActivateClient(ctx context.Context, clientID string) error {
	t, err := NewClientTask(TaskClientActivate, clientID)
	if err != nil {
		return err
	}
	_, err = e.client.EnqueueContext(ctx, t)
	return err
}

func (e *Enqueuer) DeployService(ctx context.Context, serviceID, deployID, triggeredBy string, force bool) error {
	t, err := NewServiceDeployTask(serviceID, deployID, triggeredBy, force)
	if err != nil {
		return err
	}
	_, err = e.client.EnqueueContext(ctx, t)
	return err
}

func (e *Enqueuer) StopService(ctx context.Context, serviceID string) error {
	t, err := NewServiceControlTask(TaskServiceStop, serviceID)
	if err != nil {
		return err
	}
	_, err = e.client.EnqueueContext(ctx, t)
	return err
}

func (e *Enqueuer) StartService(ctx context.Context, serviceID string) error {
	t, err := NewServiceControlTask(TaskServiceStart, serviceID)
	if err != nil {
		return err
	}
	_, err = e.client.EnqueueContext(ctx, t)
	return err
}

func (e *Enqueuer) SyncDomain(ctx context.Context, serviceID string) error {
	t, err := NewDomainSyncTask(serviceID)
	if err != nil {
		return err
	}
	_, err = e.client.EnqueueContext(ctx, t)
	return err
}
