import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { statusColor, relativeTime } from "@/lib/utils"
import { ListOrdered, Clock, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function DeploysPage() {
  const clients = await api.clients.list().catch(() => [])

  const rows = (
    await Promise.all(
      clients.map(async (c) => {
        const services = await api.services.list(c.id).catch(() => [])
        const deploys = (
          await Promise.all(services.filter(Boolean).map((s) => api.services.deploys(s.id).catch(() => [])))
        ).flat().filter(Boolean)
        return deploys.map((d) => ({
          deploy: d,
          service: services.find((s) => s?.id === d.service_id) ?? null,
          client: c,
        }))
      })
    )
  ).flat().sort((a, b) => new Date(b.deploy.created_at).getTime() - new Date(a.deploy.created_at).getTime())

  const success = rows.filter((r) => r.deploy.status === "success").length
  const failed  = rows.filter((r) => r.deploy.status === "failed").length
  const running = rows.filter((r) => r.deploy.status === "running" || r.deploy.status === "queued").length

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ListOrdered className="w-6 h-6 text-indigo-500" />
          Histórico de Deploys
        </h1>
        <p className="text-zinc-500 text-sm mt-1">{rows.length} deploys registrados</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Em andamento</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{running}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Sucesso</span>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-600">{success}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Falhas</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600">{failed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os deploys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                {["Serviço", "Cliente", "Status", "Disparado por", "Duração", "Criado"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 100).map(({ deploy, service, client }) => {
                const dur = deploy.started_at && deploy.finished_at
                  ? `${Math.round((new Date(deploy.finished_at).getTime() - new Date(deploy.started_at).getTime()) / 1000)}s`
                  : deploy.started_at ? "em andamento" : "—"
                return (
                  <tr key={deploy.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium">{service?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${client.id}`}
                        className="text-indigo-600 hover:underline text-sm">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusColor(deploy.status)}>
                        {deploy.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{deploy.triggered_by}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{dur}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {relativeTime(deploy.created_at)}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                    <ListOrdered className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum deploy registrado ainda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
