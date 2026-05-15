ALTER TABLE hardware_metrics
    ADD COLUMN IF NOT EXISTS disk_read_kb  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS disk_write_kb BIGINT NOT NULL DEFAULT 0;

-- Refresh hardware_hourly to include disk rollup
DROP MATERIALIZED VIEW IF EXISTS hardware_hourly;

CREATE MATERIALIZED VIEW hardware_hourly AS
SELECT
    date_trunc('hour', time) AS bucket,
    service_id,
    AVG(cpu_pct)::NUMERIC(5,2)  AS avg_cpu_pct,
    AVG(ram_mb)::INT             AS avg_ram_mb,
    AVG(disk_read_kb)::INT       AS avg_disk_read_kb,
    AVG(disk_write_kb)::INT      AS avg_disk_write_kb
FROM hardware_metrics
GROUP BY date_trunc('hour', time), service_id;

CREATE UNIQUE INDEX idx_hardware_hourly_bucket_service ON hardware_hourly(bucket, service_id);
