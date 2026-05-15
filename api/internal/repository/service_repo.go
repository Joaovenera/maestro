package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/venerahost/maestro/internal/models"
)

type ServiceRepo struct {
	db *pgxpool.Pool
}

func NewServiceRepo(db *pgxpool.Pool) *ServiceRepo {
	return &ServiceRepo{db: db}
}

func (r *ServiceRepo) Create(ctx context.Context, clientID uuid.UUID, name, svcType, coolifyUUID, serverUUID string) (*models.Service, error) {
	// Enforce quota
	var used, max int
	_ = r.db.QueryRow(ctx,
		`SELECT COUNT(*), (SELECT max_services FROM client_quotas WHERE client_id=$1) FROM services WHERE client_id=$1`,
		clientID).Scan(&used, &max)
	if max > 0 && used >= max {
		return nil, fmt.Errorf("quota exceeded: max %d services", max)
	}

	s := &models.Service{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO services (client_id, name, type, coolify_application_uuid, coolify_server_uuid)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, client_id, name, type, coolify_application_uuid, coolify_server_uuid, status, created_at, updated_at`,
		clientID, name, svcType, coolifyUUID, serverUUID,
	).Scan(&s.ID, &s.ClientID, &s.Name, &s.Type, &s.CoolifyApplicationUUID, &s.CoolifyServerUUID, &s.Status, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func (r *ServiceRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Service, error) {
	s := &models.Service{}
	err := r.db.QueryRow(ctx, `
		SELECT id, client_id, name, type, coolify_application_uuid, coolify_server_uuid, status, created_at, updated_at
		FROM services WHERE id = $1`, id,
	).Scan(&s.ID, &s.ClientID, &s.Name, &s.Type, &s.CoolifyApplicationUUID, &s.CoolifyServerUUID, &s.Status, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func (r *ServiceRepo) GetByCoolifyUUID(ctx context.Context, coolifyUUID string) (*models.Service, error) {
	s := &models.Service{}
	err := r.db.QueryRow(ctx, `
		SELECT id, client_id, name, type, coolify_application_uuid, coolify_server_uuid, status, created_at, updated_at
		FROM services WHERE coolify_application_uuid = $1`, coolifyUUID,
	).Scan(&s.ID, &s.ClientID, &s.Name, &s.Type, &s.CoolifyApplicationUUID, &s.CoolifyServerUUID, &s.Status, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func (r *ServiceRepo) ListByClient(ctx context.Context, clientID uuid.UUID) ([]*models.Service, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, client_id, name, type, coolify_application_uuid, coolify_server_uuid, status, created_at, updated_at
		FROM services WHERE client_id = $1 ORDER BY created_at`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var svcs []*models.Service
	for rows.Next() {
		s := &models.Service{}
		if err := rows.Scan(&s.ID, &s.ClientID, &s.Name, &s.Type, &s.CoolifyApplicationUUID, &s.CoolifyServerUUID, &s.Status, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		svcs = append(svcs, s)
	}
	return svcs, nil
}

func (r *ServiceRepo) ListAll(ctx context.Context) ([]*models.Service, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, client_id, name, type, coolify_application_uuid, coolify_server_uuid, status, created_at, updated_at
		FROM services ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var svcs []*models.Service
	for rows.Next() {
		s := &models.Service{}
		if err := rows.Scan(&s.ID, &s.ClientID, &s.Name, &s.Type, &s.CoolifyApplicationUUID, &s.CoolifyServerUUID, &s.Status, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		svcs = append(svcs, s)
	}
	return svcs, nil
}

func (r *ServiceRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status models.ServiceStatus) error {
	_, err := r.db.Exec(ctx,
		`UPDATE services SET status=$1, updated_at=$2 WHERE id=$3`,
		status, time.Now(), id)
	return err
}

func (r *ServiceRepo) UpdateStatusByCoolifyUUID(ctx context.Context, coolifyUUID string, status models.ServiceStatus) error {
	_, err := r.db.Exec(ctx,
		`UPDATE services SET status=$1, updated_at=$2 WHERE coolify_application_uuid=$3`,
		status, time.Now(), coolifyUUID)
	return err
}

func (r *ServiceRepo) UpdateStatusByServerUUID(ctx context.Context, serverUUID string, status models.ServiceStatus) error {
	_, err := r.db.Exec(ctx,
		`UPDATE services SET status=$1, updated_at=$2 WHERE coolify_server_uuid=$3`,
		status, time.Now(), serverUUID)
	return err
}
