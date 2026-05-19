import { NextRequest, NextResponse } from "next/server"

const upstream = () => `${process.env.API_URL ?? "http://localhost:3001"}/api/v1/admin/api-keys`
const auth = () => ({ Authorization: `Bearer ${process.env.MAESTRO_API_KEY ?? ""}` })

export async function GET() {
  const res = await fetch(upstream(), { headers: auth(), next: { revalidate: 0 } })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(upstream(), {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
