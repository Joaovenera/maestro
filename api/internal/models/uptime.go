package models

import (
	"time"

	"github.com/google/uuid"
)

type UptimeRecord struct {
	Time       time.Time `json:"time"`
	DomainID   uuid.UUID `json:"domain_id"`
	ServiceID  uuid.UUID `json:"service_id"`
	StatusCode int       `json:"status_code"`
	LatencyMS  int       `json:"latency_ms"`
	IsUp       bool      `json:"is_up"`
}

type UptimeSLA struct {
	DomainID   uuid.UUID `json:"domain_id"`
	Hostname   string    `json:"hostname"`
	ServiceID  uuid.UUID `json:"service_id"`
	TotalChecks int      `json:"total_checks"`
	UpChecks   int       `json:"up_checks"`
	SLAPct     float64   `json:"sla_pct"`
}
