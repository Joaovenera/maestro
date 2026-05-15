package models

import (
	"time"

	"github.com/google/uuid"
)

type ClientStatus string

const (
	ClientStatusActive    ClientStatus = "active"
	ClientStatusSuspended ClientStatus = "suspended"
	ClientStatusCancelled ClientStatus = "cancelled"
)

type Client struct {
	ID        uuid.UUID    `json:"id"`
	Name      string       `json:"name"`
	Email     string       `json:"email"`
	BillingID string       `json:"billing_id,omitempty"`
	Status    ClientStatus `json:"status"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}
