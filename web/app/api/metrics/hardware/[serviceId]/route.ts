import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params
  const apiKey = process.env.MAESTRO_API_KEY ?? ""
  const apiBase = process.env.API_URL ?? "http://localhost:3001"

  const from = req.nextUrl.searchParams.get("from") ?? ""
  const to   = req.nextUrl.searchParams.get("to")   ?? ""

  const upstream = `${apiBase}/api/v1/metrics/hardware/${serviceId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

  const res = await fetch(upstream, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
