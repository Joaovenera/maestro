CREATE TABLE services (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                 UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name                      TEXT NOT NULL,
    type                      TEXT NOT NULL,
    coolify_application_uuid  TEXT NOT NULL UNIQUE,
    coolify_server_uuid       TEXT,
    status                    TEXT NOT NULL DEFAULT 'unknown',
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_client_id ON services(client_id);
CREATE INDEX idx_services_coolify_uuid ON services(coolify_application_uuid);
