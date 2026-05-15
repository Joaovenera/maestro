CREATE TABLE client_quotas (
    client_id       UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    max_services    INT NOT NULL DEFAULT 5,
    max_domains     INT NOT NULL DEFAULT 10,
    max_ram_mb      INT NOT NULL DEFAULT 2048,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
