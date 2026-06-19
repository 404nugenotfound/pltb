import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, error: "Parameter id wajib diisi" }, { status: 400 })
    }

    const res = await fetch(`${process.env.LOUVIN_BASE_URL}/check-status?id=${id}`, {
      headers: { "x-api-key": process.env.LOUVIN_API_KEY! },
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("check-status error:", err)
    return NextResponse.json({ success: false, error: "Gagal mengecek status" }, { status: 500 })
  }
}