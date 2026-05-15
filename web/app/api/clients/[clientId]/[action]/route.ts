import { NextRequest, NextResponse } from "next/server"

const ALLOWED = new Set(["suspend", "activate"])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; action: string }> }
) {
  const { clientId, action } = await params

  if (!ALLOWED.has(action)) {
    return NextResponse.json({ message: "invalid action" }, { status: 400 })
  }

  const apiKey = process.env.MAESTRO_API_KEY ?? ""
  const apiBase = process.env.API_URL ?? "http://localhost:3001"

  const res = await fetch(`${apiBase}/api/v1/clients/${clientId}/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
