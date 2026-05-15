CREATE TABLE hardware_metrics (
    time        TIMESTAMPTZ NOT NULL DEFAULT now(),
    service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    cpu_pct     NUMERIC(5,2),
    ram_mb      INT,
    net_rx_kb   BIGINT,
    net_tx_kb   BIGINT
);

CREATE INDEX idx_hardware_metrics_service_id ON hardware_metrics(service_id, time DESC);
CREATE INDEX idx_hardware_metrics_time       ON hardware_metrics(time DESC);
