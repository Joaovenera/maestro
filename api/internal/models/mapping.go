package models

import (
	"time"

	"github.com/google/uuid"
)

type CoolifyMapping struct {
	ID              uuid.UUID `json:"id"`
	ClientID        uuid.UUID `json:"client_id"`
	CoolifyProjectID string   `json:"coolify_project_id"`
	CoolifyEnvID    string    `json:"coolify_env_id"`
	CreatedAt       time.Time `json:"created_at"`
}
