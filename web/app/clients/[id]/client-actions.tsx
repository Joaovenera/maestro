"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PauseCircle, PlayCircle, Loader2 } from "lucide-react"
import type { ClientStatus } from "@/lib/api"
import { useRouter } from "next/navigation"

export function ClientActions({ clientId, status }: { clientId: string; status: ClientStatus }) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function action(type: "suspend" | "activate") {
    setLoading(type)
    try {
      await fetch(`/api/clients/${clientId}/${type}`, { method: "POST" })
      setTimeout(() => router.refresh(), 800)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2 shrink-0">
      {status === "active" ? (
        <Button
          size="sm" variant="outline"
          onClick={() => action("suspend")}
          disabled={!!loading}
          className="gap-1.5 text-xs text-yellow-700 border-yellow-300 hover:bg-yellow-50"
        >
          {loading === "suspend" ? <Loader2 className="w-3 h-3 animate-spin" /> : <PauseCircle className="w-3 h-3" />}
          Suspender
        </Button>
      ) : status === "suspended" ? (
        <Button
          size="sm" variant="outline"
          onClick={() => action("activate")}
          disabled={!!loading}
          className="gap-1.5 text-xs text-green-700 border-green-300 hover:bg-green-50"
        >
          {loading === "activate" ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
          Ativar
        </Button>
      ) : null}
    </div>
  )
}
