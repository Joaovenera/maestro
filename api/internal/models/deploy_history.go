package models

import (
	"time"

	"github.com/google/uuid"
)

type DeployStatus string

const (
	DeployStatusQueued    DeployStatus = "queued"
	DeployStatusRunning   DeployStatus = "running"
	DeployStatusSuccess   DeployStatus = "success"
	DeployStatusFailed    DeployStatus = "failed"
	DeployStatusCancelled DeployStatus = "cancelled"
)

type DeployHistory struct {
	ID                uuid.UUID    `json:"id"`
	ServiceID         uuid.UUID    `json:"service_id"`
	CoolifyDeployUUID string       `json:"coolify_deploy_uuid,omitempty"`
	TriggeredBy       string       `json:"triggered_by"`
	Status            DeployStatus `json:"status"`
	StartedAt         *time.Time   `json:"started_at,omitempty"`
	FinishedAt        *time.Time   `json:"finished_at,omitempty"`
	LogSnippet        string       `json:"log_snippet,omitempty"`
	CreatedAt         time.Time    `json:"created_at"`
}
