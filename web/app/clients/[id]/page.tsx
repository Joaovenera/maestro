import { api } from "@/lib/api"
import { notFound } from "next/navigation"
import { ClientDetailView } from "./client-detail-view"

export const dynamic = 'force-dynamic'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [client, services, domains, slaData, quota] = await Promise.all([
    api.clients.get(id).catch(() => null),
    api.services.list(id).catch(() => []),
    api.domains.list(id).catch(() => []),
    api.metrics.sla(id).catch(() => null),
    api.clients.quota(id).catch(() => null),
  ])

  if (!client) notFound()

  const deploys = (
    await Promise.all(services.map((s) => api.services.deploys(s.id).catch(() => [])))
  ).flat().filter(Boolean).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <ClientDetailView
      client={client}
      services={services}
      domains={domains}
      slaData={slaData}
      quota={quota}
      deploys={deploys}
    />
  )
}
