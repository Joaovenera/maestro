package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/venerahost/maestro/internal/models"
)

type ClientRepo struct {
	db *pgxpool.Pool
}

func NewClientRepo(db *pgxpool.Pool) *ClientRepo {
	return &ClientRepo{db: db}
}

func (r *ClientRepo) Create(ctx context.Context, name, email, billingID string) (*models.Client, error) {
	c := &models.Client{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO clients (name, email, billing_id)
		VALUES ($1, $2, $3)
		RETURNING id, name, email, billing_id, status, created_at, updated_at`,
		name, email, billingID,
	).Scan(&c.ID, &c.Name, &c.Email, &c.BillingID, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create client: %w", err)
	}
	// Create default quota
	_, _ = r.db.Exec(ctx, `INSERT INTO client_quotas (client_id) VALUES ($1)`, c.ID)
	return c, nil
}

func (r *ClientRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Client, error) {
	c := &models.Client{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, email, billing_id, status, created_at, updated_at
		FROM clients WHERE id = $1`, id,
	).Scan(&c.ID, &c.Name, &c.Email, &c.BillingID, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get client: %w", err)
	}
	return c, nil
}

func (r *ClientRepo) List(ctx context.Context) ([]*models.Client, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, email, billing_id, status, created_at, updated_at
		FROM clients ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []*models.Client
	for rows.Next() {
		c := &models.Client{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Email, &c.BillingID, &c.Status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		clients = append(clients, c)
	}
	return clients, nil
}

func (r *ClientRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status models.ClientStatus) error {
	_, err := r.db.Exec(ctx,
		`UPDATE clients SET status = $1, updated_at = $2 WHERE id = $3`,
		status, time.Now(), id)
	return err
}

func (r *ClientRepo) Update(ctx context.Context, id uuid.UUID, name, email, billingID string) (*models.Client, error) {
	c := &models.Client{}
	err := r.db.QueryRow(ctx, `
		UPDATE clients SET name=$1, email=$2, billing_id=$3, updated_at=$4
		WHERE id=$5
		RETURNING id, name, email, billing_id, status, created_at, updated_at`,
		name, email, billingID, time.Now(), id,
	).Scan(&c.ID, &c.Name, &c.Email, &c.BillingID, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

func (r *ClientRepo) GetQuotaUsage(ctx context.Context, clientID uuid.UUID) (*models.QuotaUsage, error) {
	q := &models.QuotaUsage{}
	err := r.db.QueryRow(ctx, `
		SELECT cq.client_id, cq.max_services, cq.max_domains, cq.max_ram_mb, cq.updated_at,
		       (SELECT COUNT(*) FROM services WHERE client_id = cq.client_id) AS used_services,
		       (SELECT COUNT(*) FROM domains WHERE client_id = cq.client_id) AS used_domains
		FROM client_quotas cq WHERE cq.client_id = $1`, clientID,
	).Scan(&q.ClientID, &q.MaxServices, &q.MaxDomains, &q.MaxRAMMB, &q.UpdatedAt, &q.UsedServices, &q.UsedDomains)
	if err != nil {
		return nil, fmt.Errorf("get quota: %w", err)
	}
	return q, nil
}

func (r *ClientRepo) UpdateQuota(ctx context.Context, clientID uuid.UUID, maxServices, maxDomains, maxRAMMB int) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO client_quotas (client_id, max_services, max_domains, max_ram_mb, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (client_id) DO UPDATE SET max_services=$2, max_domains=$3, max_ram_mb=$4, updated_at=$5`,
		clientID, maxServices, maxDomains, maxRAMMB, time.Now())
	return err
}
