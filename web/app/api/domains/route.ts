import { NextRequest, NextResponse } from "next/server"

const base = () => process.env.API_URL ?? "http://localhost:3001"
const auth = () => ({ Authorization: `Bearer ${process.env.MAESTRO_API_KEY ?? ""}` })

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id") ?? ""
  const res = await fetch(`${base()}/api/v1/domains?client_id=${clientId}`, {
    headers: auth(),
    next: { revalidate: 0 },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(`${base()}/api/v1/domains`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
