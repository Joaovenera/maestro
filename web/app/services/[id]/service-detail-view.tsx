"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { statusColor, formatDate, relativeTime } from "@/lib/utils"
import { ServiceActions } from "@/app/clients/[id]/service-actions"
import { HardwareChart } from "@/components/charts/hardware-chart"
import { ScheduledDeploysPanel } from "@/components/scheduled-deploys-panel"
import Link from "next/link"
import {
  ArrowLeft, Globe, Cpu, Clock, CheckCircle2, XCircle,
  Loader2, Server, ShieldCheck, Activity, AlertTriangle,
  Hash, Calendar, User, Copy, ExternalLink, Circle, CalendarClock,
} from "lucide-react"
import type { Client, Service, Domain, DeployHistory, UptimeSLA } from "@/lib/api"
import { useState } from "react"

interface Props {
  service: Service
  client: Client | null
  domains: Domain[]
  deploys: DeployHistory[]
  serviceSla: UptimeSLA[]
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "running"    ? "bg-green-500 shadow-green-400/50" :
    status === "error" || status === "unreachable" ? "bg-red-500 shadow-red-400/50" :
    status === "deploying"  ? "bg-blue-500 shadow-blue-400/50 animate-pulse" :
    status === "stopped"    ? "bg-zinc-400" :
    "bg-zinc-300"
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shadow-md shrink-0 ${cls}`} />
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
      title="Copiar"
    >
      {copied
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color = "text-zinc-700" }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`} suppressHydrationWarning>{value}</p>
            {sub && <p className="text-xs text-zinc-400 mt-0.5" suppressHydrationWarning>{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-zinc-100">
            <Icon className="w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Deploy status icon ────────────────────────────────────────────────────────

function DeployStatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
  if (status === "failed")  return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-500 shrink-0 animate-spin" />
  if (status === "queued")  return <Clock className="w-4 h-4 text-sky-500 shrink-0" />
  return <AlertTriangle className="w-4 h-4 text-zinc-400 shrink-0" />
}

// ── SLA gauge ─────────────────────────────────────────────────────────────────

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

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0 text-sm gap-4">
      <span className="text-zinc-500 shrink-0 w-40">{label}</span>
      <span className="text-zinc-800 font-medium text-right flex items-center gap-1.5 flex-wrap justify-end">
        {children}
      </span>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ServiceDetailView({ service, client, domains, deploys, serviceSla }: Props) {
  const lastDeploy = deploys[0]

  const successCount  = deploys.filter((d) => d.status === "success").length
  const failedCount   = deploys.filter((d) => d.status === "failed").length
  const successRate   = deploys.length ? Math.round((successCount / deploys.length) * 100) : null

  const avgDuration = deploys
    .filter((d) => d.started_at && d.finished_at)
    .map((d) => (new Date(d.finished_at!).getTime() - new Date(d.started_at!).getTime()) / 1000)
  const avgDur = avgDuration.length
    ? Math.round(avgDuration.reduce((a, b) => a + b, 0) / avgDuration.length)
    : null

  const avgSla = serviceSla.length
    ? serviceSla.reduce((a, d) => a + d.sla_pct, 0) / serviceSla.length
    : null

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Breadcrumb + Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Link href="/clients" className="hover:text-zinc-600 transition-colors">Clientes</Link>
          <span>/</span>
          {client && (
            <>
              <Link href={`/clients/${client.id}`} className="hover:text-zinc-600 transition-colors">
                {client.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-zinc-600 font-medium">{service.name}</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1">
          <div className="flex items-center gap-3">
            <Link href={client ? `/clients/${client.id}` : "/clients"} className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2.5 rounded-xl bg-zinc-100">
              <Server className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusDot status={service.status} />
                <h1 className="text-2xl font-bold tracking-tight">{service.name}</h1>
                <Badge variant="outline" className="font-mono text-xs text-zinc-500">{service.type}</Badge>
                <Badge variant="outline" className={statusColor(service.status)}>{service.status}</Badge>
              </div>
              {client && (
                <Link
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-indigo-600 transition-colors mt-0.5"
                >
                  <User className="w-3 h-3" />
                  {client.name}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </Link>
              )}
            </div>
          </div>
          <ServiceActions serviceId={service.id} status={service.status} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Status"
          value={service.status}
          sub={`atualizado ${relativeTime(service.updated_at)}`}
          icon={Server}
          color={service.status === "running" ? "text-green-600" : service.status === "error" || service.status === "unreachable" ? "text-red-600" : service.status === "deploying" ? "text-blue-600" : "text-zinc-500"}
        />
        <KpiCard
          label="Taxa de sucesso"
          value={successRate != null ? `${successRate}%` : "—"}
          sub={`${successCount} ok / ${failedCount} falhas`}
          icon={Activity}
          color={successRate == null ? "text-zinc-400" : successRate >= 90 ? "text-green-600" : successRate >= 70 ? "text-yellow-600" : "text-red-600"}
        />
        <KpiCard
          label="SLA médio (30d)"
          value={avgSla != null ? `${avgSla.toFixed(2)}%` : "—"}
          sub={avgSla != null ? (avgSla >= 99 ? "Excelente" : avgSla >= 95 ? "Atenção" : "Crítico") : "Sem dados"}
          icon={ShieldCheck}
          color={avgSla == null ? "text-zinc-400" : avgSla >= 99 ? "text-green-600" : avgSla >= 95 ? "text-yellow-600" : "text-red-600"}
        />
        <KpiCard
          label="Último deploy"
          value={lastDeploy ? relativeTime(lastDeploy.created_at) : "—"}
          sub={lastDeploy ? `${lastDeploy.status}${avgDur ? ` · ~${avgDur}s avg` : ""}` : "sem histórico"}
          icon={Clock}
          color={lastDeploy?.status === "success" ? "text-green-600" : lastDeploy?.status === "failed" ? "text-red-600" : "text-zinc-500"}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="metrics">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="metrics"  className="gap-1.5"><Cpu className="w-3.5 h-3.5" />Métricas</TabsTrigger>
          <TabsTrigger value="deploys"  className="gap-1.5"><Activity className="w-3.5 h-3.5" />Deploys ({deploys.length})</TabsTrigger>
          <TabsTrigger value="domains"  className="gap-1.5"><Globe className="w-3.5 h-3.5" />Domínios ({domains.length})</TabsTrigger>
          <TabsTrigger value="sla"       className="gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />SLA / Uptime</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5"><CalendarClock className="w-3.5 h-3.5" />Agendamentos</TabsTrigger>
          <TabsTrigger value="info"     className="gap-1.5"><Hash className="w-3.5 h-3.5" />Informações</TabsTrigger>
        </TabsList>

        {/* ── Métricas ── */}
        <TabsContent value="metrics" className="mt-4">
          <HardwareChart serviceId={service.id} serviceName={service.name} />
        </TabsContent>

        {/* ── Deploys ── */}
        <TabsContent value="deploys" className="mt-4 space-y-3">
          {/* Summary bar */}
          {deploys.length > 0 && (
            <div className="flex flex-wrap gap-3 pb-1">
              {[
                { label: "Total",   val: deploys.length,  color: "bg-zinc-100 text-zinc-700" },
                { label: "Sucesso", val: successCount,    color: "bg-green-50 text-green-700 border border-green-200" },
                { label: "Falhas",  val: failedCount,     color: "bg-red-50 text-red-700 border border-red-200" },
                { label: "Duração média", val: avgDur != null ? `${avgDur}s` : "—", color: "bg-zinc-100 text-zinc-600" },
              ].map(({ label, val, color }) => (
                <span key={label} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${color}`}>
                  {label}: {val}
                </span>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    {["Status", "Disparado por", "Início", "Duração", "Criado"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deploys.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-400 text-sm">Sem deploys registrados.</td></tr>
                  )}
                  {deploys.map((d) => {
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
                        <td className="px-4 py-3 text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Circle className="w-2 h-2 fill-current text-zinc-300" />
                            {d.triggered_by}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs" suppressHydrationWarning>
                          {d.started_at ? formatDate(d.started_at) : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">{dur}</td>
                        <td className="px-4 py-3 text-xs">
                          <div suppressHydrationWarning className="text-zinc-500">{relativeTime(d.created_at)}</div>
                          <div suppressHydrationWarning className="text-zinc-300">{formatDate(d.created_at)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Domínios ── */}
        <TabsContent value="domains" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    {["Hostname", "SSL", "Primário", "Verificado em"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {domains.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-12 text-center text-zinc-400 text-sm">Nenhum domínio vinculado.</td></tr>
                  )}
                  {domains.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm">
                        <a
                          href={`${d.ssl_enabled ? "https" : "http"}://${d.hostname}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-indigo-600 hover:underline"
                        >
                          <Globe className="w-3 h-3 text-zinc-400" />
                          {d.hostname}
                          <ExternalLink className="w-3 h-3 opacity-40" />
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
                      <td className="px-4 py-3 text-zinc-400 text-xs" suppressHydrationWarning>
                        {d.verified_at ? formatDate(d.verified_at) : <span className="text-yellow-600">Pendente</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SLA ── */}
        <TabsContent value="sla" className="mt-4">
          {serviceSla.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sem dados de uptime ainda — aguarde o próximo ciclo (60s).</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {serviceSla.map((d) => (
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

        {/* ── Agendamentos ── */}
        <TabsContent value="schedule" className="mt-4">
          <ScheduledDeploysPanel serviceId={service.id} />
        </TabsContent>

        {/* ── Informações ── */}
        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-700">Identificadores</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="ID do Serviço">
                  <span className="font-mono text-xs">{service.id}</span>
                  <CopyButton text={service.id} />
                </InfoRow>
                <InfoRow label="Coolify App UUID">
                  <span className="font-mono text-xs">{service.coolify_application_uuid}</span>
                  <CopyButton text={service.coolify_application_uuid} />
                </InfoRow>
                {service.coolify_server_uuid && (
                  <InfoRow label="Coolify Server UUID">
                    <span className="font-mono text-xs">{service.coolify_server_uuid}</span>
                    <CopyButton text={service.coolify_server_uuid} />
                  </InfoRow>
                )}
                <InfoRow label="Cliente">
                  {client
                    ? <Link href={`/clients/${client.id}`} className="text-indigo-600 hover:underline flex items-center gap-1">{client.name} <ExternalLink className="w-3 h-3 opacity-50" /></Link>
                    : <span className="font-mono text-xs">{service.client_id}</span>}
                </InfoRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-700">Datas</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Tipo">
                  <Badge variant="outline" className="font-mono text-xs">{service.type}</Badge>
                </InfoRow>
                <InfoRow label="Criado em">
                  <span suppressHydrationWarning>{formatDate(service.created_at)}</span>
                  <Calendar className="w-3.5 h-3.5 text-zinc-300" />
                </InfoRow>
                <InfoRow label="Atualizado em">
                  <span suppressHydrationWarning>{formatDate(service.updated_at)}</span>
                  <Calendar className="w-3.5 h-3.5 text-zinc-300" />
                </InfoRow>
                <InfoRow label="Total de deploys">
                  <span>{deploys.length}</span>
                </InfoRow>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
