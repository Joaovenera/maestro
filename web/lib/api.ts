async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Resolved per-request so Next.js cannot inline as a build-time constant.
  // Server components: API_URL = container hostname (e.g. http://maestro-api:3001)
  // Browser: empty string → uses Next.js rewrite (/api/v1/... → API)
  const base =
    typeof window === "undefined"
      ? (process.env.API_URL ?? "http://localhost:3001")
      : ""

  const key =
    typeof window === "undefined"
      ? process.env.MAESTRO_API_KEY
      : undefined

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...options?.headers,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${path}: ${res.status} — ${text}`)
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ClientStatus = "active" | "suspended" | "cancelled"
export type ServiceStatus = "running" | "stopped" | "error" | "unknown" | "deploying" | "unreachable"
export type DeployStatus = "queued" | "running" | "success" | "failed" | "cancelled"

export interface Client {
  id: string
  name: string
  email: string
  billing_id?: string
  status: ClientStatus
  created_at: string
  updated_at: string
}

export interface QuotaUsage {
  client_id: string
  max_services: number
  max_domains: number
  max_ram_mb: number
  used_services: number
  used_domains: number
}

export interface Service {
  id: string
  client_id: string
  name: string
  type: string
  coolify_application_uuid: string
  coolify_server_uuid?: string
  status: ServiceStatus
  created_at: string
  updated_at: string
}

export interface Domain {
  id: string
  client_id: string
  service_id?: string
  hostname: string
  is_primary: boolean
  ssl_enabled: boolean
  verified_at?: string
  created_at: string
}

export interface DeployHistory {
  id: string
  service_id: string
  coolify_deploy_uuid?: string
  triggered_by: string
  status: DeployStatus
  started_at?: string
  finished_at?: string
  log_snippet?: string
  created_at: string
}

export interface DeployWithContext extends DeployHistory {
  service_name: string
  client_id: string
  client_name: string
}

export interface UptimeSLA {
  domain_id: string
  hostname: string
  service_id: string
  total_checks: number
  up_checks: number
  sla_pct: number
}

export interface HardwareMetric {
  time: string
  service_id: string
  cpu_pct: number
  ram_mb: number
  net_rx_kb: number
  net_tx_kb: number
  disk_read_kb: number
  disk_write_kb: number
}

export interface ScheduledDeploy {
  id: string
  service_id: string
  cron_expr: string
  force: boolean
  enabled: boolean
  last_run_at?: string
  created_at: string
  updated_at: string
}

export interface APIKey {
  id: string
  name: string
  key_prefix: string
  permissions: string
  last_used_at?: string
  expires_at?: string
  created_at: string
}

// ── API calls ────────────────────────────────────────────────────────────────

export const api = {
  clients: {
    list: () => request<Client[]>("/api/v1/clients").then((r) => r ?? []),
    get: (id: string) => request<Client>(`/api/v1/clients/${id}`),
    quota: (id: string) => request<QuotaUsage>(`/api/v1/clients/${id}/quota`),
    suspend: (id: string) =>
      request(`/api/v1/clients/${id}/suspend`, { method: "POST" }),
    activate: (id: string) =>
      request(`/api/v1/clients/${id}/activate`, { method: "POST" }),
  },

  services: {
    list: (clientId: string) =>
      request<Service[]>(`/api/v1/services?client_id=${clientId}`).then((r) => r ?? []),
    get: (id: string) => request<Service>(`/api/v1/services/${id}`),
    deploy: (id: string, force = false) =>
      request(`/api/v1/services/${id}/deploy`, {
        method: "POST",
        body: JSON.stringify({ force }),
      }),
    stop: (id: string) =>
      request(`/api/v1/services/${id}/stop`, { method: "POST" }),
    start: (id: string) =>
      request(`/api/v1/services/${id}/start`, { method: "POST" }),
    deploys: (id: string) =>
      request<DeployHistory[]>(`/api/v1/services/${id}/deploys`).then((r) => r ?? []),
    domains: (id: string) =>
      request<Domain[]>(`/api/v1/services/${id}/domains`).then((r) => r ?? []),
  },

  domains: {
    list: (clientId: string) =>
      request<Domain[]>(`/api/v1/domains?client_id=${clientId}`).then((r) => r ?? []),
  },

  admin: {
    apiKeys: {
      list: () => request<APIKey[]>("/api/v1/admin/api-keys").then((r) => r ?? []),
      create: (name: string, permissions: string, expiresInDays?: number) =>
        request<{ key: string; id: string; name: string; prefix: string; note: string }>(
          "/api/v1/admin/api-keys",
          { method: "POST", body: JSON.stringify({ name, permissions, expires_in_days: expiresInDays ?? 0 }) }
        ),
      revoke: (id: string) =>
        request(`/api/v1/admin/api-keys/${id}`, { method: "DELETE" }),
    },
  },

  deploys: {
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set("status", params.status)
      if (params?.limit)  q.set("limit",  String(params.limit))
      if (params?.offset) q.set("offset", String(params.offset))
      const qs = q.toString()
      return request<DeployWithContext[]>(`/api/v1/deploys${qs ? `?${qs}` : ""}`).then((r) => r ?? [])
    },
  },

  metrics: {
    sla: (clientId: string) =>
      request<{ client_id: string; days: number; domains: UptimeSLA[] }>(
        `/api/v1/metrics/sla/${clientId}`
      ),
    hardware: (serviceId: string, from: string, to: string) =>
      request<HardwareMetric[]>(
        `/api/v1/metrics/hardware/${serviceId}?from=${from}&to=${to}`
      ),
  },
}
