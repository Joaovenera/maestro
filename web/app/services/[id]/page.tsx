import { api } from "@/lib/api"
import { notFound } from "next/navigation"
import { ServiceDetailView } from "./service-detail-view"

export const dynamic = 'force-dynamic'

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const service = await api.services.get(id).catch(() => null)
  if (!service) notFound()

  const [client, domains, deploys, slaData] = await Promise.all([
    api.clients.get(service.client_id).catch(() => null),
    api.services.domains(id).catch(() => []),
    api.services.deploys(id).catch(() => []),
    api.metrics.sla(service.client_id).catch(() => null),
  ])

  const sortedDeploys = [...deploys].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Filter SLA data for this service's domains
  const serviceSla = (slaData?.domains ?? []).filter((d) =>
    domains.some((dom) => dom.id === d.domain_id)
  )

  return (
    <ServiceDetailView
      service={service}
      client={client}
      domains={domains}
      deploys={sortedDeploys}
      serviceSla={serviceSla}
    />
  )
}
