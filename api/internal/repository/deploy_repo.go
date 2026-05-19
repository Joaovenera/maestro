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
		RETURNING id, service_id, COALESCE(coolify_deploy_uuid,''), triggered_by, status, started_at, finished_at, COALESCE(log_snippet,''), created_at`,
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
		SELECT id, service_id, COALESCE(coolify_deploy_uuid,''), triggered_by, status, started_at, finished_at, COALESCE(log_snippet,''), created_at
		FROM deploy_history WHERE id=$1`, id,
	).Scan(&d.ID, &d.ServiceID, &d.CoolifyDeployUUID, &d.TriggeredBy, &d.Status, &d.StartedAt, &d.FinishedAt, &d.LogSnippet, &d.CreatedAt)
	return d, err
}

func (r *DeployRepo) ListByService(ctx context.Context, serviceID uuid.UUID, limit, offset int) ([]*models.DeployHistory, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, service_id, COALESCE(coolify_deploy_uuid,''), triggered_by, status, started_at, finished_at, COALESCE(log_snippet,''), created_at
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

func (r *DeployRepo) ListAll(ctx context.Context, limit, offset int, filterStatus string) ([]*models.DeployWithContext, error) {
	args := []any{}
	where := ""
	argN := 1
	if filterStatus != "" {
		where = fmt.Sprintf("WHERE dh.status=$%d ", argN)
		args = append(args, filterStatus)
		argN++
	}
	q := fmt.Sprintf(`
		SELECT
			dh.id, dh.service_id, COALESCE(dh.coolify_deploy_uuid,''), dh.triggered_by,
			dh.status, dh.started_at, dh.finished_at, COALESCE(dh.log_snippet,''), dh.created_at,
			s.name, s.client_id, c.name
		FROM deploy_history dh
		JOIN services s ON s.id = dh.service_id
		JOIN clients c ON c.id = s.client_id
		%sORDER BY dh.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list all deploys: %w", err)
	}
	defer rows.Close()

	deploys := make([]*models.DeployWithContext, 0)
	for rows.Next() {
		d := &models.DeployWithContext{}
		if err := rows.Scan(
			&d.ID, &d.ServiceID, &d.CoolifyDeployUUID, &d.TriggeredBy,
			&d.Status, &d.StartedAt, &d.FinishedAt, &d.LogSnippet, &d.CreatedAt,
			&d.ServiceName, &d.ClientID, &d.ClientName,
		); err != nil {
			return nil, err
		}
		deploys = append(deploys, d)
	}
	return deploys, nil
}

// ReconcileStuck marks running/queued deploys older than 2 hours as failed.
func (r *DeployRepo) ReconcileStuck(ctx context.Context) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE deploy_history
		SET status='failed', finished_at=now()
		WHERE status IN ('running','queued')
		  AND created_at < now() - INTERVAL '2 hours'`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
