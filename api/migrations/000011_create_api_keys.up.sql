CREATE TABLE api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    key_hash     TEXT NOT NULL UNIQUE,
    key_prefix   TEXT NOT NULL,       -- primeiros 12 chars para exibição (mst_XXXX...)
    permissions  TEXT NOT NULL DEFAULT 'admin'
                 CHECK (permissions IN ('admin','read')),
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions para o portal do cliente (JWT stateful)
CREATE TABLE client_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_sessions_client_id ON client_sessions(client_id);
CREATE INDEX idx_client_sessions_expires_at ON client_sessions(expires_at);
