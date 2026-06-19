import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data", "payments")

function parseReference(ref: string): { username: string; tier: string } | null {
  const parts = ref.split("-")
  if (parts.length >= 4 && parts[0] === "ventara") {
    return { tier: parts[1], username: parts[2] }
  }
  return null
}

async function savePaymentRecord(record: {
  username: string
  transaction_id: string
  tier: string
  amount: number
  payment_type: string
  reference: string
}) {
  const filePath = path.join(DATA_DIR, `${record.username}.json`)
  let records: any[] = []
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    records = JSON.parse(raw)
  } catch {}

  if (records.some((r: any) => r.transaction_id === record.transaction_id)) return

  records.push({
    transaction_id: record.transaction_id,
    tier: record.tier,
    amount: record.amount,
    payment_type: record.payment_type,
    status: "settled",
    reference: record.reference,
    paid_at: new Date().toISOString(),
  })

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf-8")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event, data } = body

    console.log("Webhook received:", event, data?.transaction_id)

    if (event === "payment.settled" && data) {
      let username: string | null = null
      let tier = "basic"

      if (data.order_id) {
        const parsed = parseReference(data.order_id)
        if (parsed) {
          username = parsed.username
          tier = parsed.tier
        }
      }

      if (!username && data.customer_name) {
        username = data.customer_name
      }

      if (username) {
        const pythonUrl = process.env.PYTHON_API_URL || "http://localhost:5000"
        await fetch(`${pythonUrl}/upgrade_tier`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Username": username,
          },
          body: JSON.stringify({ tier }),
        })
        console.log(`Upgrade success: ${username} -> ${tier}`)

        await savePaymentRecord({
          username,
          transaction_id: data.transaction_id,
          tier,
          amount: data.net_amount || data.amount || 0,
          payment_type: data.payment_type || "qris",
          reference: data.order_id || "",
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("webhook error:", err)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}