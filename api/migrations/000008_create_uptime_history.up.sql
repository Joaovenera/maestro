CREATE TABLE uptime_history (
    time        TIMESTAMPTZ NOT NULL DEFAULT now(),
    domain_id   UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status_code INT,
    latency_ms  INT,
    is_up       BOOLEAN NOT NULL
);

CREATE INDEX idx_uptime_history_domain_id  ON uptime_history(domain_id, time DESC);
CREATE INDEX idx_uptime_history_service_id ON uptime_history(service_id, time DESC);
CREATE INDEX idx_uptime_history_time       ON uptime_history(time DESC);
