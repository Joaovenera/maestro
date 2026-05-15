"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Square, Rocket, Loader2 } from "lucide-react"
import type { ServiceStatus } from "@/lib/api"
import { useRouter } from "next/navigation"

export function ServiceActions({ serviceId, status }: { serviceId: string; status: ServiceStatus }) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const apiKey = process.env.NEXT_PUBLIC_ADMIN_KEY ?? ""

  async function action(type: "deploy" | "start" | "stop") {
    setLoading(type)
    try {
      // Relative path — Next.js rewrite forwards to the API
      await fetch(`/api/v1/services/${serviceId}/${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: type === "deploy" ? JSON.stringify({ force: false }) : undefined,
      })
      setTimeout(() => router.refresh(), 1500)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => action("deploy")}
        disabled={!!loading} className="gap-1 text-xs h-7">
        {loading === "deploy" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
        Deploy
      </Button>
      {status === "running" ? (
        <Button size="sm" variant="outline" onClick={() => action("stop")}
          disabled={!!loading} className="gap-1 text-xs h-7 text-red-600 border-red-200 hover:bg-red-50">
          {loading === "stop" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
          Parar
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => action("start")}
          disabled={!!loading} className="gap-1 text-xs h-7 text-green-600 border-green-200 hover:bg-green-50">
          {loading === "start" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Iniciar
        </Button>
      )}
    </div>
  )
}
