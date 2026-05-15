-- Uptime hourly rollup view (refreshed manually or via pg_cron)
CREATE MATERIALIZED VIEW uptime_hourly AS
SELECT
    date_trunc('hour', time)              AS bucket,
    domain_id,
    COUNT(*) FILTER (WHERE is_up)         AS checks_up,
    COUNT(*)                               AS checks_total,
    AVG(latency_ms)::INT                   AS avg_latency_ms
FROM uptime_history
GROUP BY date_trunc('hour', time), domain_id;

CREATE UNIQUE INDEX idx_uptime_hourly_bucket_domain ON uptime_hourly(bucket, domain_id);

-- Hardware hourly rollup view
CREATE MATERIALIZED VIEW hardware_hourly AS
SELECT
    date_trunc('hour', time) AS bucket,
    service_id,
    AVG(cpu_pct)::NUMERIC(5,2) AS avg_cpu_pct,
    AVG(ram_mb)::INT           AS avg_ram_mb
FROM hardware_metrics
GROUP BY date_trunc('hour', time), service_id;

CREATE UNIQUE INDEX idx_hardware_hourly_bucket_service ON hardware_hourly(bucket, service_id);
