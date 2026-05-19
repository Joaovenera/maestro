"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { statusColor, formatDate, relativeTime } from "@/lib/utils"
import type { DeployWithContext } from "@/lib/api"
import Link from "next/link"
import {
  Clock, CheckCircle2, XCircle, Loader2, RefreshCw,
  GitBranch, Webhook, CalendarClock, Terminal, Server,
  AlertTriangle, Activity, ChevronDown, ChevronUp,
} from "lucide-react"

// ── Label helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  queued:    "Na fila",
  running:   "Em andamento",
  success:   "Sucesso",
  failed:    "Falha",
  cancelled: "Cancelado",
}

const TRIGGER_LABEL: Record<string, { label: string; Icon: React.ElementType }> = {
  api:       { label: "Manual",    Icon: Terminal },
  webhook:   { label: "Push",      Icon: Webhook },
  schedule:  { label: "Agendado",  Icon: CalendarClock },
  scheduled: { label: "Agendado",  Icon: CalendarClock },
  coolify:   { label: "Coolify",   Icon: Server },
}

function triggerInfo(raw: string) {
  return TRIGGER_LABEL[raw] ?? { label: raw, Icon: GitBranch }
}

// ── Duration formatting ───────────────────────────────────────────────────────

function duration(d: DeployWithContext): string {
  if (d.finished_at && d.started_at) {
    const secs = Math.round(
      (new Date(d.finished_at).getTime() - new Date(d.started_at).getTime()) / 1000
    )
    if (secs < 60) return `${secs}s`
    return `${Math.floor(secs / 60)}m${secs % 60}s`
  }
  if (d.started_at && (d.status === "running")) {
    return "em andamento"
  }
  return "—"
}

// ── Status icon ───────────────────────────────────────────────────────────────

function DeployIcon({ status }: { status: string }) {
  if (status === "success")   return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
  if (status === "failed")    return <XCircle      className="w-3.5 h-3.5 text-red-500 shrink-0" />
  if (status === "running")   return <Loader2      className="w-3.5 h-3.5 text-blue-500 shrink-0 animate-spin" />
  if (status === "queued")    return <Clock        className="w-3.5 h-3.5 text-sky-500 shrink-0" />
  return                             <AlertTriangle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, Icon, color,
}: {
  label: string; value: string | number; sub?: string
  Icon: React.ElementType; color: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-3xl font-bold mt-0.5 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-zinc-100">
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Log snippet row ───────────────────────────────────────────────────────────

function LogRow({ log }: { log: string }) {
  const [open, setOpen] = useState(false)
  const lines = log.trim().split("\n")
  const preview = lines[lines.length - 1]?.trim() ?? ""

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        <Terminal className="w-3 h-3" />
        <span className="font-mono truncate max-w-[260px]">{preview}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <pre className="mt-1 text-xs font-mono bg-zinc-900 text-zinc-100 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
          {log}
        </pre>
      )}
    </div>
  )
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTERS = [
  { key: "all",     label: "Todos" },
  { key: "running", label: "Em andamento" },
  { key: "queued",  label: "Na fila" },
  { key: "success", label: "Sucesso" },
  { key: "failed",  label: "Falha" },
] as const

type FilterKey = typeof FILTERS[number]["key"]

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  deploys: DeployWithContext[]
  stats: { total: number; active: number; success: number; failed: number; avgDuration: number | null }
}

export function DeploysView({ deploys, stats }: Props) {
  const router   = useRouter()
  const [filter, setFilter] = useState<FilterKey>("all")
  const [refreshing, setRefreshing] = useState(false)

  const hasActive = stats.active > 0

  const refresh = useCallback(() => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 800)
  }, [router])

  // Auto-refresh every 12s while there are active deploys
  useEffect(() => {
    if (!hasActive) return
    const id = setInterval(refresh, 12_000)
    return () => clearInterval(id)
  }, [hasActive, refresh])

  const visible = filter === "all"
    ? deploys
    : deploys.filter((d) => d.status === filter)

  const successRate = stats.total > 0
    ? Math.round((stats.success / stats.total) * 100)
    : null

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Em andamento"
          value={stats.active}
          sub={hasActive ? "atualizando…" : "tudo estável"}
          Icon={Activity}
          color={hasActive ? "text-blue-600" : "text-zinc-400"}
        />
        <StatCard
          label="Sucesso"
          value={stats.success}
          sub={successRate != null ? `${successRate}% dos deploys` : undefined}
          Icon={CheckCircle2}
          color="text-green-600"
        />
        <StatCard
          label="Falhas"
          value={stats.failed}
          sub={stats.total > 0 ? `${Math.round((stats.failed / stats.total) * 100)}% dos deploys` : undefined}
          Icon={XCircle}
          color={stats.failed > 0 ? "text-red-600" : "text-zinc-400"}
        />
        <StatCard
          label="Duração média"
          value={stats.avgDuration != null ? `${stats.avgDuration}s` : "—"}
          sub="deploys concluídos"
          Icon={Clock}
          color="text-zinc-600"
        />
      </div>

      {/* Filter bar + refresh button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          {FILTERS.map(({ key, label }) => {
            const count = key === "all"
              ? deploys.length
              : deploys.filter((d) => d.status === key).length
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === key
                    ? "bg-white shadow-sm text-zinc-800"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filter === key ? "bg-indigo-100 text-indigo-700" : "bg-zinc-200 text-zinc-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors px-3 py-1.5 rounded-lg border border-zinc-200 bg-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Sincronizar
        </button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-6 border-b">
          <CardTitle className="text-sm font-semibold text-zinc-600">
            {visible.length} deploy{visible.length !== 1 ? "s" : ""}
            {filter !== "all" && ` · ${FILTERS.find(f => f.key === filter)?.label}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                {["Serviço / Cliente", "Status", "Disparado por", "Duração", "Data"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
                    <p className="text-zinc-400 text-sm">Nenhum deploy encontrado.</p>
                  </td>
                </tr>
              )}
              {visible.map((d) => {
                const { label: trigLabel, Icon: TrigIcon } = triggerInfo(d.triggered_by)
                const dur = duration(d)
                const isActive = d.status === "running" || d.status === "queued"

                return (
                  <tr
                    key={d.id}
                    className={`hover:bg-zinc-50 transition-colors ${isActive ? "bg-blue-50/30" : ""}`}
                  >
                    {/* Serviço / Cliente */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/services/${d.service_id}`}
                        className="font-medium text-zinc-800 hover:text-indigo-600 transition-colors"
                      >
                        {d.service_name}
                      </Link>
                      <div>
                        <Link
                          href={`/clients/${d.client_id}`}
                          className="text-xs text-zinc-400 hover:text-indigo-500 transition-colors"
                        >
                          {d.client_name}
                        </Link>
                      </div>
                      {d.log_snippet && <LogRow log={d.log_snippet} />}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <DeployIcon status={d.status} />
                        <Badge variant="outline" className={`text-xs ${statusColor(d.status)}`}>
                          {STATUS_LABEL[d.status] ?? d.status}
                        </Badge>
                      </div>
                    </td>

                    {/* Disparado por */}
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                        <TrigIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        {trigLabel}
                      </span>
                    </td>

                    {/* Duração */}
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs ${
                        isActive ? "text-blue-600 font-semibold" : "text-zinc-500"
                      }`}>
                        {dur}
                      </span>
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3">
                      <div className="text-xs text-zinc-600" suppressHydrationWarning>
                        {relativeTime(d.created_at)}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5" suppressHydrationWarning>
                        {formatDate(d.created_at)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
