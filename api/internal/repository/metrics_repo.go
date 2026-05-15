package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/venerahost/maestro/internal/models"
)

type MetricsRepo struct {
	db *pgxpool.Pool
}

func NewMetricsRepo(db *pgxpool.Pool) *MetricsRepo {
	return &MetricsRepo{db: db}
}

func (r *MetricsRepo) InsertHardware(ctx context.Context, m *models.HardwareMetric) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO hardware_metrics (time, service_id, cpu_pct, ram_mb, net_rx_kb, net_tx_kb, disk_read_kb, disk_write_kb)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		m.Time, m.ServiceID, m.CPUPct, m.RAMMB, m.NetRxKB, m.NetTxKB, m.DiskReadKB, m.DiskWriteKB)
	return err
}

func (r *MetricsRepo) InsertUptime(ctx context.Context, u *models.UptimeRecord) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO uptime_history (time, domain_id, service_id, status_code, latency_ms, is_up)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		u.Time, u.DomainID, u.ServiceID, u.StatusCode, u.LatencyMS, u.IsUp)
	return err
}

func (r *MetricsRepo) GetHardwareTimeline(ctx context.Context, serviceID uuid.UUID, from, to time.Time) ([]*models.HardwareMetric, error) {
	rows, err := r.db.Query(ctx, `
		SELECT time, service_id, cpu_pct, ram_mb, net_rx_kb, net_tx_kb, disk_read_kb, disk_write_kb
		FROM hardware_metrics
		WHERE service_id=$1 AND time BETWEEN $2 AND $3
		ORDER BY time`, serviceID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var metrics []*models.HardwareMetric
	for rows.Next() {
		m := &models.HardwareMetric{}
		if err := rows.Scan(&m.Time, &m.ServiceID, &m.CPUPct, &m.RAMMB, &m.NetRxKB, &m.NetTxKB, &m.DiskReadKB, &m.DiskWriteKB); err != nil {
			return nil, err
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

func (r *MetricsRepo) GetUptimeHistory(ctx context.Context, domainID uuid.UUID, from, to time.Time) ([]*models.UptimeRecord, error) {
	rows, err := r.db.Query(ctx, `
		SELECT time, domain_id, service_id, status_code, latency_ms, is_up
		FROM uptime_history
		WHERE domain_id=$1 AND time BETWEEN $2 AND $3
		ORDER BY time`, domainID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*models.UptimeRecord
	for rows.Next() {
		u := &models.UptimeRecord{}
		if err := rows.Scan(&u.Time, &u.DomainID, &u.ServiceID, &u.StatusCode, &u.LatencyMS, &u.IsUp); err != nil {
			return nil, err
		}
		records = append(records, u)
	}
	return records, nil
}

func (r *MetricsRepo) GetSLAByClient(ctx context.Context, clientID uuid.UUID, days int) ([]*models.UptimeSLA, error) {
	from := time.Now().AddDate(0, 0, -days)
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.hostname, d.service_id,
		       COUNT(*) AS total_checks,
		       COUNT(*) FILTER (WHERE u.is_up) AS up_checks
		FROM domains d
		JOIN uptime_history u ON u.domain_id = d.id
		WHERE d.client_id = $1 AND u.time >= $2
		GROUP BY d.id, d.hostname, d.service_id`, clientID, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*models.UptimeSLA
	for rows.Next() {
		s := &models.UptimeSLA{}
		if err := rows.Scan(&s.DomainID, &s.Hostname, &s.ServiceID, &s.TotalChecks, &s.UpChecks); err != nil {
			return nil, err
		}
		if s.TotalChecks > 0 {
			s.SLAPct = float64(s.UpChecks) / float64(s.TotalChecks) * 100
		}
		results = append(results, s)
	}
	return results, nil
}
