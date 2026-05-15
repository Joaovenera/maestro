package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/venerahost/maestro/internal/models"
)

type DomainRepo struct {
	db *pgxpool.Pool
}

func NewDomainRepo(db *pgxpool.Pool) *DomainRepo {
	return &DomainRepo{db: db}
}

func (r *DomainRepo) Create(ctx context.Context, clientID uuid.UUID, hostname string, sslEnabled bool) (*models.Domain, error) {
	// Enforce quota
	var used, max int
	_ = r.db.QueryRow(ctx,
		`SELECT COUNT(*), (SELECT max_domains FROM client_quotas WHERE client_id=$1) FROM domains WHERE client_id=$1`,
		clientID).Scan(&used, &max)
	if max > 0 && used >= max {
		return nil, fmt.Errorf("quota exceeded: max %d domains", max)
	}

	d := &models.Domain{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO domains (client_id, hostname, ssl_enabled)
		VALUES ($1, $2, $3)
		RETURNING id, client_id, service_id, hostname, is_primary, ssl_enabled, verified_at, created_at, updated_at`,
		clientID, hostname, sslEnabled,
	).Scan(&d.ID, &d.ClientID, &d.ServiceID, &d.Hostname, &d.IsPrimary, &d.SSLEnabled, &d.VerifiedAt, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func (r *DomainRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Domain, error) {
	d := &models.Domain{}
	err := r.db.QueryRow(ctx, `
		SELECT id, client_id, service_id, hostname, is_primary, ssl_enabled, verified_at, created_at, updated_at
		FROM domains WHERE id = $1`, id,
	).Scan(&d.ID, &d.ClientID, &d.ServiceID, &d.Hostname, &d.IsPrimary, &d.SSLEnabled, &d.VerifiedAt, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func (r *DomainRepo) ListByClient(ctx context.Context, clientID uuid.UUID) ([]*models.Domain, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, client_id, service_id, hostname, is_primary, ssl_enabled, verified_at, created_at, updated_at
		FROM domains WHERE client_id=$1 ORDER BY is_primary DESC, hostname`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDomains(rows)
}

func (r *DomainRepo) ListByService(ctx context.Context, serviceID uuid.UUID) ([]*models.Domain, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, client_id, service_id, hostname, is_primary, ssl_enabled, verified_at, created_at, updated_at
		FROM domains WHERE service_id=$1 ORDER BY is_primary DESC, hostname`, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDomains(rows)
}

// ListAssignedActive returns all domains with an assigned service for uptime checking.
func (r *DomainRepo) ListAssignedActive(ctx context.Context) ([]*models.Domain, error) {
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.client_id, d.service_id, d.hostname, d.is_primary, d.ssl_enabled, d.verified_at, d.created_at, d.updated_at
		FROM domains d
		JOIN services s ON s.id = d.service_id
		WHERE d.service_id IS NOT NULL AND s.status != 'stopped'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDomains(rows)
}

func (r *DomainRepo) Assign(ctx context.Context, id, serviceID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE domains SET service_id=$1, updated_at=$2 WHERE id=$3`,
		serviceID, time.Now(), id)
	return err
}

func (r *DomainRepo) Unassign(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE domains SET service_id=NULL, updated_at=$1 WHERE id=$2`,
		time.Now(), id)
	return err
}

func (r *DomainRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM domains WHERE id=$1`, id)
	return err
}

func (r *DomainRepo) MarkVerified(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE domains SET verified_at=$1, updated_at=$1 WHERE id=$2`,
		time.Now(), id)
	return err
}

// BuildFQDN returns the Coolify-formatted fqdn string for all domains of a service.
func (r *DomainRepo) BuildFQDN(ctx context.Context, serviceID uuid.UUID) (string, error) {
	rows, err := r.db.Query(ctx,
		`SELECT hostname, ssl_enabled FROM domains WHERE service_id=$1 ORDER BY is_primary DESC, hostname`,
		serviceID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var parts []string
	for rows.Next() {
		var hostname string
		var ssl bool
		if err := rows.Scan(&hostname, &ssl); err != nil {
			return "", err
		}
		scheme := "http"
		if ssl {
			scheme = "https"
		}
		parts = append(parts, scheme+"://"+hostname)
	}
	return strings.Join(parts, ","), nil
}

func scanDomains(rows interface{ Next() bool; Scan(...any) error }) ([]*models.Domain, error) {
	var domains []*models.Domain
	for rows.Next() {
		d := &models.Domain{}
		if err := rows.Scan(&d.ID, &d.ClientID, &d.ServiceID, &d.Hostname, &d.IsPrimary, &d.SSLEnabled, &d.VerifiedAt, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		domains = append(domains, d)
	}
	return domains, nil
}
