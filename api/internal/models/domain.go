package models

import (
	"time"

	"github.com/google/uuid"
)

type Domain struct {
	ID         uuid.UUID  `json:"id"`
	ClientID   uuid.UUID  `json:"client_id"`
	ServiceID  *uuid.UUID `json:"service_id,omitempty"`
	Hostname   string     `json:"hostname"`
	IsPrimary  bool       `json:"is_primary"`
	SSLEnabled bool       `json:"ssl_enabled"`
	VerifiedAt *time.Time `json:"verified_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}
