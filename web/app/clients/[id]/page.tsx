import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { statusColor, formatDate, relativeTime } from "@/lib/utils"
import { ServiceActions } from "./service-actions"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, Cpu, Clock } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [client, services, domains, slaData] = await Promise.all([
    api.clients.get(id).catch(() => null),
    api.services.list(id).catch(() => []),
    api.domains.list(id).catch(() => []),
    api.metrics.sla(id).catch(() => null),
  ])

  if (!client) notFound()

  const deploys = (
    await Promise.all(services.map((s) => api.services.deploys(s.id).catch(() => [])))
  ).flat().filter(Boolean).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-700">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-zinc-500 text-sm">{client.email}</p>
        </div>
        <Badge variant="outline" className={`ml-auto ${statusColor(client.status)}`}>
          {client.status}
        </Badge>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="domains">Domínios</TabsTrigger>
          <TabsTrigger value="deploys">Histórico de Deploys</TabsTrigger>
          <TabsTrigger value="sla">SLA / Uptime</TabsTrigger>
        </TabsList>

        {/* Serviços */}
        <TabsContent value="services" className="mt-4 space-y-4">
          {services.map((svc) => (
            <Card key={svc.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-4 h-4 text-zinc-400" />
                    <CardTitle className="text-base">{svc.name}</CardTitle>
                    <Badge variant="outline" className="text-xs text-zinc-500">{svc.type}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={statusColor(svc.status)}>
                      {svc.status}
                    </Badge>
                    <ServiceActions serviceId={svc.id} status={svc.status} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-zinc-400 font-mono">
                  uuid: {svc.coolify_application_uuid}
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {domains.filter((d) => d.service_id === svc.id).map((d) => (
                    <span key={d.id}
                      className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                      {d.ssl_enabled ? "https" : "http"}://{d.hostname}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {services.length === 0 && (
            <p className="text-zinc-400 text-sm">Nenhum serviço cadastrado.</p>
          )}
        </TabsContent>

        {/* Domínios */}
        <TabsContent value="domains" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    {["Hostname", "SSL", "Serviço", "Verificado em"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {domains.map((d) => {
                    const svc = services.find((s) => s.id === d.service_id)
                    return (
                      <tr key={d.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono text-sm flex items-center gap-2">
                          <Globe className="w-3 h-3 text-zinc-400" />
                          {d.hostname}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={d.ssl_enabled
                            ? "bg-green-500/10 text-green-700 border-green-200"
                            : "bg-zinc-200 text-zinc-500"}>
                            {d.ssl_enabled ? "HTTPS" : "HTTP"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{svc?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">
                          {d.verified_at ? formatDate(d.verified_at) : "Pendente"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deploys */}
        <TabsContent value="deploys" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    {["Serviço", "Status", "Disparado por", "Duração", "Criado"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deploys.slice(0, 30).map((d) => {
                    const svc = services.find((s) => s.id === d.service_id)
                    const dur = d.started_at && d.finished_at
                      ? `${Math.round((new Date(d.finished_at).getTime() - new Date(d.started_at).getTime()) / 1000)}s`
                      : "—"
                    return (
                      <tr key={d.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium">{svc?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={statusColor(d.status)}>
                            {d.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{d.triggered_by}</td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">{dur}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />{relativeTime(d.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                  {deploys.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">Sem deploys registrados</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA */}
        <TabsContent value="sla" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(slaData?.domains ?? []).map((d) => (
              <Card key={d.domain_id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-zinc-600">{d.hostname}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${d.sla_pct >= 99 ? "text-green-600" : d.sla_pct >= 95 ? "text-yellow-600" : "text-red-600"}`}>
                    {d.sla_pct.toFixed(2)}%
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {d.up_checks}/{d.total_checks} checks OK nos últimos 30 dias
                  </div>
                  <div className="mt-3 w-full bg-zinc-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${d.sla_pct >= 99 ? "bg-green-500" : d.sla_pct >= 95 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${d.sla_pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            {!slaData?.domains?.length && (
              <p className="text-zinc-400 text-sm col-span-3">Ainda sem dados de uptime — aguarde o próximo ciclo do checker (60s).</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
