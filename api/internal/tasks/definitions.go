package tasks

import (
	"encoding/json"

	"github.com/hibiken/asynq"
)

const (
	TaskClientSuspend  = "client:suspend"
	TaskClientActivate = "client:activate"
	TaskServiceDeploy  = "service:deploy"
	TaskServiceStop    = "service:stop"
	TaskServiceStart   = "service:start"
	TaskDomainSync     = "domain:sync"
)

type ClientPayload struct {
	ClientID string `json:"client_id"`
}

type ServicePayload struct {
	ServiceID  string `json:"service_id"`
	Force      bool   `json:"force,omitempty"`
	DeployID   string `json:"deploy_id,omitempty"`
	TriggeredBy string `json:"triggered_by,omitempty"`
}

type DomainSyncPayload struct {
	ServiceID string `json:"service_id"`
}

func NewClientTask(taskType, clientID string) (*asynq.Task, error) {
	p, err := json.Marshal(ClientPayload{ClientID: clientID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(taskType, p, asynq.Queue("critical")), nil
}

func NewServiceDeployTask(serviceID, deployID, triggeredBy string, force bool) (*asynq.Task, error) {
	p, err := json.Marshal(ServicePayload{ServiceID: serviceID, Force: force, DeployID: deployID, TriggeredBy: triggeredBy})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskServiceDeploy, p, asynq.Queue("default"), asynq.MaxRetry(3)), nil
}

func NewServiceControlTask(taskType, serviceID string) (*asynq.Task, error) {
	p, err := json.Marshal(ServicePayload{ServiceID: serviceID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(taskType, p, asynq.Queue("critical")), nil
}

func NewDomainSyncTask(serviceID string) (*asynq.Task, error) {
	p, err := json.Marshal(DomainSyncPayload{ServiceID: serviceID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskDomainSync, p, asynq.Queue("critical")), nil
}
