package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/venerahost/maestro/internal/models"
)

type ScheduledRepo struct {
	db *pgxpool.Pool
}

func NewScheduledRepo(db *pgxpool.Pool) *ScheduledRepo {
	return &ScheduledRepo{db: db}
}

func (r *ScheduledRepo) Create(ctx context.Context, serviceID uuid.UUID, cronExpr string, force bool) (*models.ScheduledDeploy, error) {
	sd := &models.ScheduledDeploy{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO scheduled_deploys (service_id, cron_expr, force)
		VALUES ($1, $2, $3)
		RETURNING id, service_id, cron_expr, force, enabled, last_run_at, created_at, updated_at`,
		serviceID, cronExpr, force,
	).Scan(&sd.ID, &sd.ServiceID, &sd.CronExpr, &sd.Force, &sd.Enabled, &sd.LastRunAt, &sd.CreatedAt, &sd.UpdatedAt)
	return sd, err
}

func (r *ScheduledRepo) ListEnabled(ctx context.Context) ([]*models.ScheduledDeploy, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, service_id, cron_expr, force, enabled, last_run_at, created_at, updated_at
		FROM scheduled_deploys WHERE enabled=true`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScheduled(rows)
}

func (r *ScheduledRepo) ListByService(ctx context.Context, serviceID uuid.UUID) ([]*models.ScheduledDeploy, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, service_id, cron_expr, force, enabled, last_run_at, created_at, updated_at
		FROM scheduled_deploys WHERE service_id=$1`, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScheduled(rows)
}

func (r *ScheduledRepo) Update(ctx context.Context, id uuid.UUID, cronExpr string, force, enabled bool) (*models.ScheduledDeploy, error) {
	sd := &models.ScheduledDeploy{}
	err := r.db.QueryRow(ctx, `
		UPDATE scheduled_deploys SET cron_expr=$1, force=$2, enabled=$3, updated_at=$4
		WHERE id=$5
		RETURNING id, service_id, cron_expr, force, enabled, last_run_at, created_at, updated_at`,
		cronExpr, force, enabled, time.Now(), id,
	).Scan(&sd.ID, &sd.ServiceID, &sd.CronExpr, &sd.Force, &sd.Enabled, &sd.LastRunAt, &sd.CreatedAt, &sd.UpdatedAt)
	return sd, err
}

func (r *ScheduledRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM scheduled_deploys WHERE id=$1`, id)
	return err
}

func (r *ScheduledRepo) TouchLastRun(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE scheduled_deploys SET last_run_at=$1 WHERE id=$2`, time.Now(), id)
	return err
}

func scanScheduled(rows interface{ Next() bool; Scan(...any) error }) ([]*models.ScheduledDeploy, error) {
	var list []*models.ScheduledDeploy
	for rows.Next() {
		sd := &models.ScheduledDeploy{}
		if err := rows.Scan(&sd.ID, &sd.ServiceID, &sd.CronExpr, &sd.Force, &sd.Enabled, &sd.LastRunAt, &sd.CreatedAt, &sd.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, sd)
	}
	return list, nil
}
