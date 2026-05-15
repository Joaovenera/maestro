package models

import (
	"time"

	"github.com/google/uuid"
)

type ServiceStatus string

const (
	ServiceStatusUnknown     ServiceStatus = "unknown"
	ServiceStatusRunning     ServiceStatus = "running"
	ServiceStatusStopped     ServiceStatus = "stopped"
	ServiceStatusError       ServiceStatus = "error"
	ServiceStatusUnreachable ServiceStatus = "unreachable"
	ServiceStatusDeploying   ServiceStatus = "deploying"
)

type Service struct {
	ID                     uuid.UUID     `json:"id"`
	ClientID               uuid.UUID     `json:"client_id"`
	Name                   string        `json:"name"`
	Type                   string        `json:"type"`
	CoolifyApplicationUUID string        `json:"coolify_application_uuid"`
	CoolifyServerUUID      string        `json:"coolify_server_uuid,omitempty"`
	Status                 ServiceStatus `json:"status"`
	CreatedAt              time.Time     `json:"created_at"`
	UpdatedAt              time.Time     `json:"updated_at"`
}
