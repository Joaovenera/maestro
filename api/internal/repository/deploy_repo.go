package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/venerahost/maestro/internal/models"
)

type DeployRepo struct {
	db *pgxpool.Pool
}

func NewDeployRepo(db *pgxpool.Pool) *DeployRepo {
	return &DeployRepo{db: db}
}

func (r *DeployRepo) Create(ctx context.Context, serviceID uuid.UUID, triggeredBy string) (*models.DeployHistory, error) {
	d := &models.DeployHistory{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO deploy_history (service_id, triggered_by)
		VALUES ($1, $2)
		RETURNING id, service_id, coolify_deploy_uuid, triggered_by, status, started_at, finished_at, log_snippet, created_at`,
		serviceID, triggeredBy,
	).Scan(&d.ID, &d.ServiceID, &d.CoolifyDeployUUID, &d.TriggeredBy, &d.Status, &d.StartedAt, &d.FinishedAt, &d.LogSnippet, &d.CreatedAt)
	return d, err
}

func (r *DeployRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status models.DeployStatus, coolifyUUID string) error {
	now := time.Now()
	var err error
	switch status {
	case models.DeployStatusRunning:
		_, err = r.db.Exec(ctx,
			`UPDATE deploy_history SET status=$1, coolify_deploy_uuid=$2, started_at=$3 WHERE id=$4`,
			status, coolifyUUID, now, id)
	case models.DeployStatusSuccess, models.DeployStatusFailed, models.DeployStatusCancelled:
		_, err = r.db.Exec(ctx,
			`UPDATE deploy_history SET status=$1, coolify_deploy_uuid=$2, finished_at=$3 WHERE id=$4`,
			status, coolifyUUID, now, id)
	default:
		_, err = r.db.Exec(ctx, `UPDATE deploy_history SET status=$1 WHERE id=$2`, status, id)
	}
	return err
}

func (r *DeployRepo) UpdateStatusByCoolifyUUID(ctx context.Context, coolifyUUID string, status models.DeployStatus) error {
	_, err := r.db.Exec(ctx,
		`UPDATE deploy_history SET status=$1, finished_at=$2 WHERE coolify_deploy_uuid=$3`,
		status, time.Now(), coolifyUUID)
	return err
}

func (r *DeployRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.DeployHistory, error) {
	d := &models.DeployHistory{}
	err := r.db.QueryRow(ctx, `
		SELECT id, service_id, coolify_deploy_uuid, triggered_by, status, started_at, finished_at, log_snippet, created_at
		FROM deploy_history WHERE id=$1`, id,
	).Scan(&d.ID, &d.ServiceID, &d.CoolifyDeployUUID, &d.TriggeredBy, &d.Status, &d.StartedAt, &d.FinishedAt, &d.LogSnippet, &d.CreatedAt)
	return d, err
}

func (r *DeployRepo) ListByService(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]*models.DeployHistory, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, service_id, coolify_deploy_uuid, triggered_by, status, started_at, finished_at, log_snippet, created_at
		FROM deploy_history WHERE service_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		serviceID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list deploys: %w", err)
	}
	defer rows.Close()

	var deploys []*models.DeployHistory
	for rows.Next() {
		d := &models.DeployHistory{}
		if err := rows.Scan(&d.ID, &d.ServiceID, &d.CoolifyDeployUUID, &d.TriggeredBy, &d.Status, &d.StartedAt, &d.FinishedAt, &d.LogSnippet, &d.CreatedAt); err != nil {
			return nil, err
		}
		deploys = append(deploys, d)
	}
	return deploys, nil
}
