CREATE TABLE deploy_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id          UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    coolify_deploy_uuid TEXT,
    triggered_by        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','running','success','failed','cancelled')),
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    log_snippet         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deploy_history_service_id ON deploy_history(service_id);
CREATE INDEX idx_deploy_history_created_at ON deploy_history(created_at DESC);
