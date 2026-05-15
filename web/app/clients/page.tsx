import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { statusColor, formatDate } from "@/lib/utils"
import Link from "next/link"
import { Users, ArrowRight, PlusCircle } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const clients = await api.clients.list().catch(() => [])

  const withStats = await Promise.all(
    clients.map(async (c) => {
      const [services, quota, sla] = await Promise.all([
        api.services.list(c.id).catch(() => []),
        api.clients.quota(c.id).catch(() => null),
        api.metrics.sla(c.id).catch(() => null),
      ])
      const avgSLA =
        (sla?.domains?.reduce((a, d) => a + d.sla_pct, 0) ?? 0) /
        (sla?.domains?.length || 1)
      const running = services.filter((s) => s?.status === "running").length
      return { client: c, services, quota, avgSLA, running }
    })
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Clientes
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          <PlusCircle className="w-4 h-4" />
          Novo cliente
        </button>
      </div>

      <div className="grid gap-4">
        {withStats.map(({ client, services, quota, avgSLA, running }) => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{client.name}</CardTitle>
                  <p className="text-sm text-zinc-500 mt-0.5">{client.email}</p>
                </div>
                <Badge variant="outline" className={statusColor(client.status)}>
                  {client.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Stat label="Serviços" value={`${running}/${services.length} ativos`} />
                <Stat label="Domínios" value={`${quota?.used_domains ?? 0}/${quota?.max_domains ?? "—"}`} />
                <Stat
                  label="SLA 30d"
                  value={services.length ? `${avgSLA.toFixed(2)}%` : "—"}
                  highlight={avgSLA >= 99}
                />
                <Stat label="Desde" value={formatDate(client.created_at).split(",")[0]} />
              </div>

              {/* Serviços chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {services.filter(Boolean).map((s) => (
                  <Badge key={s.id} variant="outline" className={`text-xs ${statusColor(s.status)}`}>
                    {s.name}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xs text-zinc-400 font-mono">{client.id}</span>
                <Link
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Ver detalhes <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {clients.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum cliente cadastrado</p>
            <p className="text-sm mt-1">Use a API para criar o primeiro cliente.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? "text-green-600" : "text-zinc-800"}`}>
        {value}
      </p>
    </div>
  )
}
