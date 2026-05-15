package models

import (
	"time"

	"github.com/google/uuid"
)

type ClientQuota struct {
	ClientID    uuid.UUID `json:"client_id"`
	MaxServices int       `json:"max_services"`
	MaxDomains  int       `json:"max_domains"`
	MaxRAMMB    int       `json:"max_ram_mb"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type QuotaUsage struct {
	ClientQuota
	UsedServices int `json:"used_services"`
	UsedDomains  int `json:"used_domains"`
}
