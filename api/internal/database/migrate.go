package database

import (
	"embed"
	"fmt"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func RunMigrations(migrationFS embed.FS, databaseURL string) error {
	src, err := iofs.New(migrationFS, ".")
	if err != nil {
		return fmt.Errorf("create iofs source: %w", err)
	}

	// golang-migrate pgx/v5 driver uses pgx5:// scheme
	pgxURL := "pgx5://" + databaseURL[len("postgres://"):]

	m, err := migrate.NewWithSourceInstance("iofs", src, pgxURL)
	if err != nil {
		return fmt.Errorf("create migrate instance: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("run migrations: %w", err)
	}

	version, _, _ := m.Version()
	slog.Info("migrations applied", "version", version)
	return nil
}
