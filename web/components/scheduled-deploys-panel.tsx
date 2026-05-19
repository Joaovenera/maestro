"use client"

import { useEffect, useState, useCallback } from "react"
import { CalendarClock, Plus, Trash2, Pencil, X, ToggleLeft, ToggleRight, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ScheduledDeploy } from "@/lib/api"

// ── Cron helpers ──────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "A cada hora",     expr: "0 * * * *" },
  { label: "Todo dia 00:00",  expr: "0 0 * * *" },
  { label: "Todo dia 06:00",  expr: "0 6 * * *" },
  { label: "Toda segunda",    expr: "0 0 * * 1" },
  { label: "A cada 6h",       expr: "0 */6 * * *" },
  { label: "A cada 12h",      expr: "0 */12 * * *" },
] as const

function validateCron(expr: string): string | null {
  const p = expr.trim().split(/\s+/)
  if (p.length !== 5) return "Expressão cron deve ter exatamente 5 campos (min hora dia mês diaSemana)"
  return null
}

function describeCron(expr: string): string {
  const p = expr.trim().split(/\s+/)
  if (p.length !== 5) return expr
  const [min, hour, dom, , dow] = p
  if (min === "*" && hour === "*") return "A cada minuto"
  if (min !== "*" && hour === "*") return `No minuto ${min} de cada hora`
  if (hour !== "*" && dom === "*" && dow === "*") return `Todo dia às ${hour.padStart(2,"0")}:${min.padStart(2,"0")}`
  if (dow !== "*" && dom === "*") {
    const days = ["dom","seg","ter","qua","qui","sex","sáb"]
    const d = parseInt(dow)
    const dayName = isNaN(d) ? dow : (days[d] ?? dow)
    return `Toda ${dayName} às ${hour.padStart(2,"0")}:${min.padStart(2,"0")}`
  }
  return expr
}

function fmtDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function relTime(iso?: string) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return "agora"
  if (m < 60)  return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    if (open) document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl ring-1 ring-zinc-200 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// ── Schedule dialog ───────────────────────────────────────────────────────────

interface ScheduleDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  serviceId: string
  editing?: ScheduledDeploy | null
}

function ScheduleDialog({ open, onClose, onSaved, serviceId, editing }: ScheduleDialogProps) {
  const [expr, setExpr] = useState(editing?.cron_expr ?? "0 0 * * *")
  const [force, setForce] = useState(editing?.force ?? false)
  const [enabled, setEnabled] = useState(editing?.enabled ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setExpr(editing?.cron_expr ?? "0 0 * * *")
      setForce(editing?.force ?? false)
      setEnabled(editing?.enabled ?? true)
      setError(null)
    }
  }, [open, editing])

  const cronError = validateCron(expr)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cronError) { setError(cronError); return }
    setLoading(true); setError(null)
    try {
      if (editing) {
        const res = await fetch(`/api/scheduled-deploys/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cron_expr: expr, force, enabled }),
        })
        if (!res.ok) throw new Error((await res.json()).message ?? `HTTP ${res.status}`)
      } else {
        const res = await fetch("/api/scheduled-deploys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service_id: serviceId, cron_expr: expr, force }),
        })
        if (!res.ok) throw new Error((await res.json()).message ?? `HTTP ${res.status}`)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-500" />
          <h2 className="font-semibold text-sm">{editing ? "Editar agendamento" : "Novo agendamento"}</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-5">

        {/* Presets */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-600">Predefinições</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.expr}
                type="button"
                onClick={() => setExpr(p.expr)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  expr === p.expr
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cron expression */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">
            Expressão cron <span className="font-normal text-zinc-400">(min hora dia mês diaSemana)</span>
          </label>
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="0 0 * * *"
          />
          {expr && !cronError && (
            <p className="text-xs text-indigo-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {describeCron(expr)}
            </p>
          )}
          {cronError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {cronError}
            </p>
          )}
        </div>

        {/* Options */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-sm text-zinc-700">Force deploy</span>
          </label>
          {editing && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-sm text-zinc-700">Habilitado</span>
            </label>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancelar
          </button>
          <Button type="submit" disabled={loading || !!cronError} className="gap-1.5">
            {loading ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  serviceId: string
}

export function ScheduledDeploysPanel({ serviceId }: Props) {
  const [schedules, setSchedules] = useState<ScheduledDeploy[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledDeploy | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scheduled-deploys?service_id=${serviceId}`)
      const data: ScheduledDeploy[] = await res.json()
      setSchedules(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [serviceId])

  useEffect(() => { fetch_() }, [fetch_])

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(s: ScheduledDeploy) { setEditing(s); setDialogOpen(true) }

  async function toggleEnabled(s: ScheduledDeploy) {
    setToggling(s.id)
    try {
      await fetch(`/api/scheduled-deploys/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cron_expr: s.cron_expr, force: s.force, enabled: !s.enabled }),
      })
      await fetch_()
    } finally {
      setToggling(null)
    }
  }

  async function deleteSchedule(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/scheduled-deploys/${id}`, { method: "DELETE" })
      await fetch_()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-zinc-400" />
          Deploys Agendados
        </CardTitle>
        <Button size="sm" onClick={openCreate} className="gap-1.5 h-7 text-xs">
          <Plus className="w-3.5 h-3.5" />Novo agendamento
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-10 text-center text-zinc-400 text-sm animate-pulse">Carregando...</div>
        ) : schedules.length === 0 ? (
          <div className="py-10 text-center text-zinc-400">
            <CalendarClock className="w-7 h-7 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum agendamento configurado.</p>
            <p className="text-xs text-zinc-300 mt-1">Clique em "Novo agendamento" para criar.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                {["", "Expressão cron", "Force", "Último disparo", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {schedules.map((s) => (
                <tr key={s.id} className={`transition-colors ${s.enabled ? "hover:bg-zinc-50" : "bg-zinc-50/50 opacity-60"}`}>
                  {/* Toggle */}
                  <td className="pl-4 py-3 w-8">
                    <button
                      onClick={() => toggleEnabled(s)}
                      disabled={toggling === s.id}
                      className="text-zinc-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                      title={s.enabled ? "Desabilitar" : "Habilitar"}
                    >
                      {s.enabled
                        ? <ToggleRight className="w-5 h-5 text-indigo-500" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </td>
                  {/* Cron */}
                  <td className="px-4 py-3">
                    <code className="font-mono text-sm text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded">
                      {s.cron_expr}
                    </code>
                    <p className="text-xs text-zinc-400 mt-0.5">{describeCron(s.cron_expr)}</p>
                  </td>
                  {/* Force */}
                  <td className="px-4 py-3">
                    {s.force
                      ? <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">force</Badge>
                      : <span className="text-zinc-300 text-xs">—</span>}
                  </td>
                  {/* Last run */}
                  <td className="px-4 py-3 text-xs">
                    {s.last_run_at ? (
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span title={fmtDate(s.last_run_at)}>{relTime(s.last_run_at)}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-300 italic">nunca</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteSchedule(s.id)}
                        disabled={deleting === s.id}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      <ScheduleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fetch_}
        serviceId={serviceId}
        editing={editing}
      />
    </Card>
  )
}
