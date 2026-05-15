CREATE TABLE domains (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_id  UUID REFERENCES services(id) ON DELETE SET NULL,
    hostname    TEXT NOT NULL UNIQUE,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    ssl_enabled BOOLEAN NOT NULL DEFAULT true,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_domains_client_id  ON domains(client_id);
CREATE INDEX idx_domains_service_id ON domains(service_id);
