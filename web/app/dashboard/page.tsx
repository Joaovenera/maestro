import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { statusColor } from "@/lib/utils"
import { Users, Globe, Activity, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const clients = await api.clients.list().catch(() => [])

  const allServices = (
    await Promise.all(clients.map((c) => api.services.list(c.id).catch(() => [])))
  ).flat().filter(Boolean)

  const allSLAs = (
    await Promise.all(clients.map((c) => api.metrics.sla(c.id).catch(() => null)))
  ).filter(Boolean)

  const totalDomains = allSLAs.reduce((acc, s) => acc + (s?.domains?.length ?? 0), 0)
  const avgSLA =
    allSLAs.flatMap((s) => s?.domains ?? []).reduce((a, d) => a + d.sla_pct, 0) /
    (allSLAs.flatMap((s) => s?.domains ?? []).length || 1)

  const running = allServices.filter((s) => s.status === "running").length

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Visão geral da infraestrutura</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-4 h-4" />} label="Clientes" value={clients.length} />
        <StatCard icon={<Activity className="w-4 h-4" />} label="Serviços ativos"
          value={`${running}/${allServices.length}`} />
        <StatCard icon={<Globe className="w-4 h-4" />} label="Domínios" value={totalDomains} />
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="SLA médio 30d"
          value={`${avgSLA.toFixed(2)}%`} highlight={avgSLA >= 99} />
      </div>

      {/* Clients table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                {["Nome", "Email", "Status", "Serviços", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => {
                const svcs = allServices.filter((s) => s.client_id === c.id)
                const sla = allSLAs.find((s) => s?.client_id === c.id)
                const avgClientSLA =
                  (sla?.domains?.reduce((a, d) => a + d.sla_pct, 0) ?? 0) /
                  (sla?.domains?.length || 1)
                return (
                  <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{c.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusColor(c.status)}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {svcs.map((s) => (
                          <Badge key={s.id} variant="outline" className={statusColor(s.status)}>
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-4">
                        {sla && (
                          <span className={`text-xs font-mono ${avgClientSLA >= 99 ? "text-green-600" : "text-yellow-600"}`}>
                            SLA {avgClientSLA.toFixed(2)}%
                          </span>
                        )}
                        <Link href={`/clients/${c.id}`}
                          className="text-indigo-600 hover:underline text-xs">
                          Ver detalhes →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {clients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">Nenhum cliente cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: string | number; highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-500 text-sm">{label}</span>
          <span className="text-zinc-400">{icon}</span>
        </div>
        <div className={`text-2xl font-bold ${highlight ? "text-green-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
