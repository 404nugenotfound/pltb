import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, payment_type, customer_name, tier } = body

    if (!amount || !customer_name) {
      return NextResponse.json({ success: false, error: "amount dan customer_name wajib diisi" }, { status: 400 })
    }

    const reference = `ventara-${tier || "basic"}-${customer_name}-${Date.now()}`

    const res = await fetch(`${process.env.LOUVIN_BASE_URL}/create-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.LOUVIN_API_KEY!,
      },
      body: JSON.stringify({
        amount,
        payment_type: payment_type || "qris",
        customer_name,
        description: `Upgrade ${tier || "basic"} - ${customer_name}`,
        reference,
        source_url: req.headers.get("origin") || "https://limpixel.com",
      }),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error("create-transaction error:", err)
    return NextResponse.json({ success: false, error: "Gagal membuat transaksi" }, { status: 500 })
  }
}