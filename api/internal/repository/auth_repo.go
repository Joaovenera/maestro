package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/venerahost/maestro/internal/models"
)

type AuthRepo struct {
	db *pgxpool.Pool
}

func NewAuthRepo(db *pgxpool.Pool) *AuthRepo {
	return &AuthRepo{db: db}
}

// GenerateAPIKey creates a new API key, returns (key, model, error).
// The raw key is returned only once — store it safely.
func (r *AuthRepo) GenerateAPIKey(ctx context.Context, name, permissions string, expiresAt *time.Time) (string, *models.APIKey, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, fmt.Errorf("generate random bytes: %w", err)
	}
	key := "mst_" + hex.EncodeToString(raw)
	hash := hashKey(key)
	prefix := key[:12]

	k := &models.APIKey{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO api_keys (name, key_hash, key_prefix, permissions, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, key_prefix, permissions, last_used_at, expires_at, created_at`,
		name, hash, prefix, permissions, expiresAt,
	).Scan(&k.ID, &k.Name, &k.KeyPrefix, &k.Permissions, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt)
	if err != nil {
		return "", nil, fmt.Errorf("insert api key: %w", err)
	}
	return key, k, nil
}

// ValidateAPIKey checks the key hash and returns the key record if valid.
func (r *AuthRepo) ValidateAPIKey(ctx context.Context, rawKey string) (*models.APIKey, error) {
	hash := hashKey(rawKey)
	k := &models.APIKey{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, key_prefix, permissions, last_used_at, expires_at, created_at
		FROM api_keys
		WHERE key_hash = $1
		  AND (expires_at IS NULL OR expires_at > now())`,
		hash,
	).Scan(&k.ID, &k.Name, &k.KeyPrefix, &k.Permissions, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt)
	if err != nil {
		return nil, err
	}
	// Update last_used_at async — fire and forget
	go func() {
		_, _ = r.db.Exec(context.Background(),
			`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, k.ID)
	}()
	return k, nil
}

func (r *AuthRepo) ListAPIKeys(ctx context.Context) ([]*models.APIKey, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, key_prefix, permissions, last_used_at, expires_at, created_at
		FROM api_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []*models.APIKey
	for rows.Next() {
		k := &models.APIKey{}
		if err := rows.Scan(&k.ID, &k.Name, &k.KeyPrefix, &k.Permissions, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, nil
}

func (r *AuthRepo) DeleteAPIKey(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM api_keys WHERE id = $1`, id)
	return err
}

// CreateClientSession generates a session token for a client (portal login).
func (r *AuthRepo) CreateClientSession(ctx context.Context, clientID uuid.UUID, ttl time.Duration) (string, *models.ClientSession, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, err
	}
	token := "portal_" + hex.EncodeToString(raw)
	hash := hashKey(token)
	expires := time.Now().Add(ttl)

	s := &models.ClientSession{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO client_sessions (client_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, client_id, expires_at, created_at`,
		clientID, hash, expires,
	).Scan(&s.ID, &s.ClientID, &s.ExpiresAt, &s.CreatedAt)
	if err != nil {
		return "", nil, err
	}
	return token, s, nil
}

// ValidateClientSession checks a portal token and returns the client_id.
func (r *AuthRepo) ValidateClientSession(ctx context.Context, rawToken string) (uuid.UUID, error) {
	hash := hashKey(rawToken)
	var clientID uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT client_id FROM client_sessions
		WHERE token_hash = $1 AND expires_at > now()`,
		hash,
	).Scan(&clientID)
	return clientID, err
}

func (r *AuthRepo) RevokeClientSession(ctx context.Context, rawToken string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM client_sessions WHERE token_hash = $1`, hashKey(rawToken))
	return err
}

func (r *AuthRepo) PurgeExpiredSessions(ctx context.Context) error {
	_, err := r.db.Exec(ctx, `DELETE FROM client_sessions WHERE expires_at < now()`)
	return err
}

func hashKey(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}
