DROP MATERIALIZED VIEW IF EXISTS hardware_hourly;

ALTER TABLE hardware_metrics
    DROP COLUMN IF EXISTS disk_read_kb,
    DROP COLUMN IF EXISTS disk_write_kb;

CREATE MATERIALIZED VIEW hardware_hourly AS
SELECT
    date_trunc('hour', time) AS bucket,
    service_id,
    AVG(cpu_pct)::NUMERIC(5,2) AS avg_cpu_pct,
    AVG(ram_mb)::INT            AS avg_ram_mb
FROM hardware_metrics
GROUP BY date_trunc('hour', time), service_id;

CREATE UNIQUE INDEX idx_hardware_hourly_bucket_service ON hardware_hourly(bucket, service_id);
