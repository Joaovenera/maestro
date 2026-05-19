import { NextRequest, NextResponse } from "next/server"

const base = () => process.env.API_URL ?? "http://localhost:3001"
const auth = () => ({ Authorization: `Bearer ${process.env.MAESTRO_API_KEY ?? ""}` })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const res = await fetch(`${base()}/api/v1/domains/${id}/assign`, {
    method: "PATCH",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
