import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { statusColor, formatDate } from "@/lib/utils"
import { Globe, CheckCircle2, XCircle, Clock, Link2 } from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function DomainsPage() {
  const clients = await api.clients.list().catch(() => [])

  const rows = (
    await Promise.all(
      clients.map(async (c) => {
        const [domains, services] = await Promise.all([
          api.domains.list(c.id).catch(() => []),
          api.services.list(c.id).catch(() => []),
        ])
        return domains.filter(Boolean).map((d) => ({
          domain: d,
          client: c,
          service: services.find((s) => s?.id === d.service_id) ?? null,
        }))
      })
    )
  ).flat()

  const assigned = rows.filter((r) => r.domain.service_id)
  const unassigned = rows.filter((r) => !r.domain.service_id)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-500" />
          Domínios
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {rows.length} domínio{rows.length !== 1 ? "s" : ""} —{" "}
          {assigned.length} atribuído{assigned.length !== 1 ? "s" : ""},{" "}
          {unassigned.length} livre{unassigned.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<Globe className="w-4 h-4 text-indigo-500" />}
          label="Total" value={rows.length}
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          label="Verificados"
          value={rows.filter((r) => r.domain.verified_at).length}
        />
        <SummaryCard
          icon={<Clock className="w-4 h-4 text-yellow-500" />}
          label="Pendentes"
          value={rows.filter((r) => !r.domain.verified_at).length}
        />
      </div>

      {/* Main table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os domínios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                {["Hostname", "Cliente", "Serviço", "SSL", "Verificado", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ domain, client, service }) => (
                <tr key={domain.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="font-mono text-sm font-medium">{domain.hostname}</span>
                      {domain.is_primary && (
                        <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200">
                          primary
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/clients/${client.id}`}
                      className="text-indigo-600 hover:underline text-sm">
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {service ? (
                      <Badge variant="outline" className={`text-xs ${statusColor(service.status)}`}>
                        {service.name}
                      </Badge>
                    ) : (
                      <span className="text-zinc-400 text-xs italic">não atribuído</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {domain.ssl_enabled ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> HTTPS
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-zinc-400 text-xs">
                        <XCircle className="w-3 h-3" /> HTTP
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {domain.verified_at ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {formatDate(domain.verified_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-yellow-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`${domain.ssl_enabled ? "https" : "http"}://${domain.hostname}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-indigo-600 transition-colors"
                    >
                      <Link2 className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                    <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum domínio cadastrado</p>
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

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">{label}</span>
          {icon}
        </div>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
