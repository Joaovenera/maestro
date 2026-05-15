package models

import (
	"time"

	"github.com/google/uuid"
)

type HardwareMetric struct {
	Time        time.Time `json:"time"`
	ServiceID   uuid.UUID `json:"service_id"`
	CPUPct      float64   `json:"cpu_pct"`
	RAMMB       int       `json:"ram_mb"`
	NetRxKB     int64     `json:"net_rx_kb"`
	NetTxKB     int64     `json:"net_tx_kb"`
	DiskReadKB  int64     `json:"disk_read_kb"`
	DiskWriteKB int64     `json:"disk_write_kb"`
}
