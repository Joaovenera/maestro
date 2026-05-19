import { api } from "@/lib/api"
import { ListOrdered } from "lucide-react"
import { DeploysView } from "./deploys-view"

export const dynamic = 'force-dynamic'

export default async function DeploysPage() {
  const deploys = await api.deploys.list({ limit: 200 }).catch(() => [])

  const total   = deploys.length
  const active  = deploys.filter((d) => d.status === "running" || d.status === "queued").length
  const success = deploys.filter((d) => d.status === "success").length
  const failed  = deploys.filter((d) => d.status === "failed").length

  const durations = deploys
    .filter((d) => d.started_at && d.finished_at)
    .map((d) => (new Date(d.finished_at!).getTime() - new Date(d.started_at!).getTime()) / 1000)
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-indigo-500" />
            Histórico de Deploys
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{total} registro{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <DeploysView
        deploys={deploys}
        stats={{ total, active, success, failed, avgDuration }}
      />
    </div>
  )
}
