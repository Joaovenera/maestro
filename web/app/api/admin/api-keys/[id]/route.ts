import { NextRequest, NextResponse } from "next/server"

const auth = () => ({ Authorization: `Bearer ${process.env.MAESTRO_API_KEY ?? ""}` })

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const base = process.env.API_URL ?? "http://localhost:3001"
  const res = await fetch(`${base}/api/v1/admin/api-keys/${id}`, {
    method: "DELETE",
    headers: auth(),
  })
  return new NextResponse(null, { status: res.status })
}
