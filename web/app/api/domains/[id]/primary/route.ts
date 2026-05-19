import { NextRequest, NextResponse } from "next/server"

const base = () => process.env.API_URL ?? "http://localhost:3001"
const auth = () => ({ Authorization: `Bearer ${process.env.MAESTRO_API_KEY ?? ""}` })

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await fetch(`${base()}/api/v1/domains/${id}/primary`, {
    method: "PATCH",
    headers: auth(),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
