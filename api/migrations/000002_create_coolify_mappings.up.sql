CREATE TABLE coolify_mappings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    coolify_project_id   TEXT NOT NULL,
    coolify_env_id       TEXT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coolify_mappings_client_id ON coolify_mappings(client_id);
