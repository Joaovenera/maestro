GO      := /home/deploy/go-install/go/bin/go
DB_URL  ?= $(DATABASE_URL)
export DOCKER_BUILDKIT := 1

.PHONY: build-api build-worker build docker-build docker-up docker-down \
        run-api run-worker dev tidy vet

# ── Binários locais ──────────────────────────────────────────────────────────
build-api:
	$(GO) build -o bin/maestro-api ./cmd/api

build-worker:
	$(GO) build -o bin/maestro-worker ./cmd/worker

build: build-api build-worker

tidy:
	$(GO) mod tidy

vet:
	$(GO) vet ./...

run-api:
	$(GO) run ./cmd/api

run-worker:
	$(GO) run ./cmd/worker

# ── Docker (BuildKit cache mount — rápido a partir do 2º build) ─────────────
docker-build:
	DOCKER_BUILDKIT=1 docker compose build

docker-up:
	DOCKER_BUILDKIT=1 docker compose up -d

docker-down:
	docker compose down

# ── Dev local (sobe apenas infra, roda binários na máquina) ─────────────────
dev:
	docker compose up postgres-local redis-local asynqmon -d

.DEFAULT_GOAL := build
