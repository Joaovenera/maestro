package models

import (
	"time"

	"github.com/google/uuid"
)

type ScheduledDeploy struct {
	ID        uuid.UUID  `json:"id"`
	ServiceID uuid.UUID  `json:"service_id"`
	CronExpr  string     `json:"cron_expr"`
	Force     bool       `json:"force"`
	Enabled   bool       `json:"enabled"`
	LastRunAt *time.Time `json:"last_run_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
