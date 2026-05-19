"use client"

import { useEffect, useState, useCallback } from "react"
import { KeyRound, Plus, Trash2, Copy, CheckCircle2, X, ShieldCheck, Eye, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { APIKey } from "@/lib/api"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function relativeTime(iso?: string) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return "agora"
  if (m < 60)  return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

// ── Overlay modal ─────────────────────────────────────────────────────────────

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    if (open) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl ring-1 ring-zinc-200 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
        copied
          ? "bg-green-100 text-green-700"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
      } ${className}`}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  )
}

// ── Create dialog ─────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (key: string) => void
}

function CreateDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [name, setName] = useState("")
  const [permissions, setPermissions] = useState<"admin" | "read">("read")
  const [expiresInDays, setExpiresInDays] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName(""); setPermissions("read"); setExpiresInDays(""); setError(null)
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Nome é obrigatório"); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          permissions,
          expires_in_days: expiresInDays ? parseInt(expiresInDays) : 0,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const data = await res.json()
      reset()
      onCreated(data.key)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-500" />
          <h2 className="font-semibold text-sm">Nova API Key</h2>
        </div>
        <button onClick={handleClose} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: GitHub Actions, Zabbix..."
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Permissão</label>
          <div className="flex gap-2">
            {(["admin", "read"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPermissions(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  permissions === p
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}
              >
                {p === "admin" ? "Admin (leitura + escrita)" : "Read-only"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">
            Expira em (dias) <span className="text-zinc-400 font-normal">— vazio = sem expiração</span>
          </label>
          <input
            type="number"
            min={1}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            placeholder="ex: 365"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </button>
          <Button type="submit" disabled={loading} className="gap-1.5">
            {loading ? "Criando..." : "Criar Key"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Key reveal modal ──────────────────────────────────────────────────────────

function KeyRevealModal({ open, rawKey, onClose }: { open: boolean; rawKey: string; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b bg-green-50">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <h2 className="font-semibold text-sm text-green-800">Key criada com sucesso</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-green-100 text-green-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <Eye className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Esta é a <strong>única vez</strong> que a key completa será exibida. Copie e salve em local seguro agora.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-600">Sua API Key</label>
          <div className="flex items-center gap-2 bg-zinc-950 rounded-xl px-4 py-3">
            <code className="flex-1 text-green-400 text-xs font-mono break-all leading-relaxed">
              {rawKey}
            </code>
          </div>
          <div className="flex justify-end">
            <CopyButton text={rawKey} />
          </div>
        </div>
        <Button onClick={onClose} className="w-full">
          Entendi, fechar
        </Button>
      </div>
    </Modal>
  )
}

// ── Revoke confirm modal ──────────────────────────────────────────────────────

function RevokeModal({
  open,
  keyName,
  onConfirm,
  onClose,
  loading,
}: { open: boolean; keyName: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500" />
          <h2 className="font-semibold text-sm">Revogar Key</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-zinc-600">
          Tem certeza que deseja revogar a key <strong>&quot;{keyName}&quot;</strong>?
          Qualquer integração que a use vai parar de funcionar imediatamente.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Revogando..." : "Revogar"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<APIKey | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/api-keys")
      const data: APIKey[] = await res.json()
      setKeys(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  function handleCreated(key: string) {
    setCreating(false)
    setRawKey(key)
    fetchKeys()
  }

  async function handleRevoke() {
    if (!revoking) return
    setRevokeLoading(true)
    try {
      await fetch(`/api/admin/api-keys/${revoking.id}`, { method: "DELETE" })
      setRevoking(null)
      fetchKeys()
    } finally {
      setRevokeLoading(false)
    }
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-500" />
            API Keys
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {keys.length} key{keys.length !== 1 ? "s" : ""} ativa{keys.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nova Key
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
            Keys cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-zinc-400 text-sm animate-pulse">Carregando...</div>
          ) : keys.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma API key cadastrada.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  {["Nome", "Prefixo", "Permissão", "Último uso", "Expira em", "Criada em", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {keys.map((k) => {
                  const expired = k.expires_at && new Date(k.expires_at) < new Date()
                  return (
                    <tr key={k.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="font-medium text-zinc-800">{k.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs bg-zinc-100 px-2 py-0.5 rounded text-zinc-600">
                          {k.key_prefix}…
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={k.permissions === "admin"
                            ? "text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "text-xs bg-zinc-50 text-zinc-600 border-zinc-200"
                          }
                        >
                          {k.permissions}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {k.last_used_at ? (
                          <span title={fmtDateTime(k.last_used_at)}>
                            {relativeTime(k.last_used_at)}
                          </span>
                        ) : (
                          <span className="text-zinc-300 italic">nunca</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {k.expires_at ? (
                          <span className={`flex items-center gap-1 ${expired ? "text-red-500" : "text-zinc-500"}`}>
                            <Clock className="w-3 h-3" />
                            {fmtDate(k.expires_at)}
                            {expired && <span className="text-red-500">(expirada)</span>}
                          </span>
                        ) : (
                          <span className="text-zinc-300 italic">sem expiração</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {fmtDate(k.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setRevoking(k)}
                          className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Revogar key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={handleCreated}
      />
      <KeyRevealModal
        open={rawKey !== null}
        rawKey={rawKey ?? ""}
        onClose={() => setRawKey(null)}
      />
      <RevokeModal
        open={revoking !== null}
        keyName={revoking?.name ?? ""}
        onConfirm={handleRevoke}
        onClose={() => setRevoking(null)}
        loading={revokeLoading}
      />
    </div>
  )
}
