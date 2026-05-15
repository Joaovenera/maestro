"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { statusColor, formatDate, relativeTime } from "@/lib/utils"
import { ServiceActions } from "./service-actions"
import { ClientActions } from "./client-actions"
import { HardwareChart } from "@/components/charts/hardware-chart"
import Link from "next/link"
import {
  ArrowLeft, Globe, Cpu, Clock, CheckCircle2, XCircle,
  Loader2, Server, ShieldCheck, BarChart3, Activity,
  Calendar, Hash, Mail, CreditCard, AlertTriangle, Circle,
} from "lucide-react"
import type { Client, Service, Domain, DeployHistory, QuotaUsage, UptimeSLA } from "@/lib/api"

interface Props {
  client: Client
  services: Service[]
  domains: Domain[]
  slaData: { client_id: string; days: number; domains: UptimeSLA[] } | null
  quota: QuotaUsage | null
  deploys: DeployHistory[]
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
      style={{ background: `hsl(${hue} 60% 45%)` }}
    >
      {initials}
    </div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, color = "text-zinc-700" }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-zinc-100">
            <Icon className="w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuotaBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-indigo-500"
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-600 font-medium">{label}</span>
        <span className="text-zinc-400">{used} / {max}</span>
      </div>
      <div className="w-full bg-zinc-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DeployStatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-500 shrink-0 animate-spin" />
  if (status === "queued") return <Clock className="w-4 h-4 text-sky-500 shrink-0" />
  return <AlertTriangle className="w-4 h-4 text-zinc-400 shrink-0" />
}

function SlaGauge({ pct }: { pct: number }) {
  const color = pct >= 99 ? "#22c55e" : pct >= 95 ? "#eab308" : "#ef4444"
  const radius = 36
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="8" />
      <circle
        cx="44" cy="44" r={radius} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="44" y="49" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
        {pct.toFixed(1)}%
      </text>
    </svg>
  )
}

export function ClientDetailView({ client, services, domains, slaData, quota, deploys }: Props) {
  const running = services.filter((s) => s.status === "running").length
  const avgSla = slaData?.domains?.length
    ? slaData.domains.reduce((a, d) => a + d.sla_pct, 0) / slaData.domains.length
    : null
  const lastDeploy = deploys[0]

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients" className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Avatar name={client.name} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              <Badge variant="outline" className={statusColor(client.status)}>
                {client.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap text-sm text-zinc-500">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>
              {client.billing_id && (
                <span className="flex items-center gap-1 font-mono text-xs">
                  <CreditCard className="w-3 h-3" />{client.billing_id}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />Cliente desde {formatDate(client.created_at).split(",")[0]}
              </span>
              <span className="flex items-center gap-1 font-mono text-xs text-zinc-400">
                <Hash className="w-3 h-3" />{client.id.slice(0, 8)}…
              </span>
            </div>
          </div>
        </div>
        <ClientActions clientId={client.id} status={client.status} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Serviços ativos"
          value={`${running}/${services.length}`}
          sub={services.length > 0 ? `${Math.round((running / services.length) * 100)}% online` : "nenhum serviço"}
          icon={Server}
          color={running > 0 ? "text-green-600" : "text-zinc-500"}
        />
        <KpiCard
          label="Domínios"
          value={`${domains.length}`}
          sub={`${domains.filter((d) => d.ssl_enabled).length} com HTTPS`}
          icon={Globe}
        />
        <KpiCard
          label="SLA médio (30d)"
          value={avgSla != null ? `${avgSla.toFixed(2)}%` : "—"}
          sub={avgSla != null && avgSla >= 99 ? "Excelente" : avgSla != null && avgSla >= 95 ? "Atenção" : "Sem dados"}
          icon={ShieldCheck}
          color={avgSla == null ? "text-zinc-400" : avgSla >= 99 ? "text-green-600" : avgSla >= 95 ? "text-yellow-600" : "text-red-600"}
        />
        <KpiCard
          label="Último deploy"
          value={lastDeploy ? relativeTime(lastDeploy.created_at) : "—"}
          sub={lastDeploy ? lastDeploy.status : "sem histórico"}
          icon={Activity}
          color={lastDeploy?.status === "success" ? "text-green-600" : lastDeploy?.status === "failed" ? "text-red-600" : "text-zinc-500"}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="services">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="services" className="gap-1.5"><Server className="w-3.5 h-3.5" />Serviços ({services.length})</TabsTrigger>
          <TabsTrigger value="domains" className="gap-1.5"><Globe className="w-3.5 h-3.5" />Domínios ({domains.length})</TabsTrigger>
          <TabsTrigger value="deploys" className="gap-1.5"><Activity className="w-3.5 h-3.5" />Deploys ({deploys.length})</TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />SLA / Uptime</TabsTrigger>
          <TabsTrigger value="quota" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Quota</TabsTrigger>
        </TabsList>

        {/* Serviços */}
        <TabsContent value="services" className="mt-4 space-y-3">
          {services.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum serviço cadastrado.</p>
            </div>
          )}
          {services.map((svc) => {
            const svcDomains = domains.filter((d) => d.service_id === svc.id)
            const svcDeploys = deploys.filter((d) => d.service_id === svc.id)
            const lastSvcDeploy = svcDeploys[0]
            return (
              <Card key={svc.id} className="overflow-hidden">
                <CardHeader className="pb-3 bg-zinc-50/60 border-b">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${svc.status === "running" ? "bg-green-500" : svc.status === "error" || svc.status === "unreachable" ? "bg-red-500" : svc.status === "deploying" ? "bg-blue-500 animate-pulse" : "bg-zinc-400"}`} />
                      <CardTitle className="text-base">{svc.name}</CardTitle>
                      <Badge variant="outline" className="text-xs text-zinc-500 font-mono">{svc.type}</Badge>
                      <Badge variant="outline" className={`text-xs ${statusColor(svc.status)}`}>{svc.status}</Badge>
                    </div>
                    <ServiceActions serviceId={svc.id} status={svc.status} />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Coolify UUID</p>
                      <p className="font-mono text-xs text-zinc-600 break-all">{svc.coolify_application_uuid}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Criado em</p>
                      <p className="text-zinc-600 text-xs">{formatDate(svc.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Último deploy</p>
                      <p className="text-zinc-600 text-xs flex items-center gap-1">
                        {lastSvcDeploy ? (
                          <>{relativeTime(lastSvcDeploy.created_at)} — <Badge variant="outline" className={`text-xs ${statusColor(lastSvcDeploy.status)}`}>{lastSvcDeploy.status}</Badge></>
                        ) : "—"}
                      </p>
                    </div>
                  </div>
                  {svcDomains.length > 0 && (
                    <div className="mt-4 flex gap-2 flex-wrap">
                      {svcDomains.map((d) => (
                        <a
                          key={d.id}
                          href={`${d.ssl_enabled ? "https" : "http"}://${d.hostname}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors"
                        >
                          <Globe className="w-3 h-3" />
                          {d.ssl_enabled ? "https" : "http"}://{d.hostname}
                          {d.is_primary && <span className="ml-1 text-indigo-400 font-medium">primário</span>}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-5">
                    <HardwareChart
                      serviceId={svc.id}
                      serviceName={svc.name}
                      maxRamMb={quota?.max_ram_mb ?? 0}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* Domínios */}
        <TabsContent value="domains" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    {["Hostname", "SSL", "Primário", "Serviço", "Verificado em"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {domains.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-400 text-sm">Nenhum domínio cadastrado.</td></tr>
                  )}
                  {domains.map((d) => {
                    const svc = services.find((s) => s.id === d.service_id)
                    return (
                      <tr key={d.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm">
                          <a
                            href={`${d.ssl_enabled ? "https" : "http"}://${d.hostname}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-indigo-600 hover:underline"
                          >
                            <Globe className="w-3 h-3 text-zinc-400" />{d.hostname}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={d.ssl_enabled ? "bg-green-500/10 text-green-700 border-green-200" : "bg-zinc-200 text-zinc-500"}>
                            {d.ssl_enabled ? "HTTPS" : "HTTP"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {d.is_primary
                            ? <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium"><CheckCircle2 className="w-3 h-3" />Sim</span>
                            : <span className="text-xs text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-sm">{svc?.name ?? <span className="text-zinc-400">—</span>}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">
                          {d.verified_at ? formatDate(d.verified_at) : <span className="text-yellow-600">Pendente</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deploys */}
        <TabsContent value="deploys" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    {["Status", "Serviço", "Disparado por", "Duração", "Iniciado"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deploys.slice(0, 50).map((d) => {
                    const svc = services.find((s) => s.id === d.service_id)
                    const dur = d.started_at && d.finished_at
                      ? `${Math.round((new Date(d.finished_at).getTime() - new Date(d.started_at).getTime()) / 1000)}s`
                      : "—"
                    return (
                      <tr key={d.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <DeployStatusIcon status={d.status} />
                            <Badge variant="outline" className={`text-xs ${statusColor(d.status)}`}>{d.status}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-700">{svc?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Circle className="w-2 h-2 fill-current text-zinc-300" />
                            {d.triggered_by}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">{dur}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">
                          <div>{relativeTime(d.created_at)}</div>
                          <div className="text-zinc-300">{formatDate(d.created_at)}</div>
                        </td>
                      </tr>
                    )
                  })}
                  {deploys.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-400">Sem deploys registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA */}
        <TabsContent value="sla" className="mt-4">
          {!slaData?.domains?.length ? (
            <div className="text-center py-16 text-zinc-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sem dados de uptime ainda — aguarde o próximo ciclo do checker (60s).</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {slaData.domains.map((d) => (
                <Card key={d.domain_id}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-mono text-sm text-zinc-700 truncate">{d.hostname}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{d.up_checks}/{d.total_checks} checks OK — 30 dias</p>
                        <div className="mt-3 w-full bg-zinc-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${d.sla_pct >= 99 ? "bg-green-500" : d.sla_pct >= 95 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${d.sla_pct}%` }}
                          />
                        </div>
                        <p className="text-xs mt-1 text-zinc-400">
                          {d.sla_pct >= 99 ? "🟢 Excelente" : d.sla_pct >= 95 ? "🟡 Atenção" : "🔴 Crítico"}
                        </p>
                      </div>
                      <SlaGauge pct={d.sla_pct} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Quota */}
        <TabsContent value="quota" className="mt-4">
          {!quota ? (
            <div className="text-center py-16 text-zinc-400">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sem dados de quota disponíveis.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-zinc-700">Uso de Recursos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <QuotaBar label="Serviços" used={quota.used_services} max={quota.max_services} />
                  <QuotaBar label="Domínios" used={quota.used_domains} max={quota.max_domains} />
                  {quota.max_ram_mb > 0 && (
                    <QuotaBar label="RAM (MB)" used={0} max={quota.max_ram_mb} />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-zinc-700">Limites do Plano</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Máx. Serviços", value: quota.max_services },
                    { label: "Máx. Domínios", value: quota.max_domains },
                    { label: "RAM máxima", value: quota.max_ram_mb > 0 ? `${quota.max_ram_mb} MB` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">{label}</span>
                      <span className="font-semibold text-zinc-800">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
