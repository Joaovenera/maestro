"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PlusCircle, X, User, Mail, CreditCard, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

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
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl ring-1 ring-zinc-200 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export function NewClientButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [billingId, setBillingId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName(""); setEmail(""); setBillingId(""); setError(null)
  }

  function handleClose() { reset(); setOpen(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())  { setError("Nome é obrigatório"); return }
    if (!email.trim()) { setError("E-mail é obrigatório"); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          billing_id: billingId.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? `Erro ${res.status}`)
      }
      handleClose()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        Novo cliente
      </button>

      <Modal open={open} onClose={handleClose}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-sm">Novo cliente</h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />Nome <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente ou empresa"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />E-mail <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Billing ID
              <span className="text-zinc-400 font-normal">(opcional)</span>
            </label>
            <input
              value={billingId}
              onChange={(e) => setBillingId(e.target.value)}
              placeholder="ID no Stripe ou sistema de cobrança"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
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
              <PlusCircle className="w-3.5 h-3.5" />
              {loading ? "Criando..." : "Criar cliente"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
