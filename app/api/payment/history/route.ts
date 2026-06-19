import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data", "payments")

function userFile(username: string): string {
  return path.join(DATA_DIR, `${username}.json`)
}

async function readPayments(username: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(userFile(username), "utf-8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writePayments(username: string, records: any[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(userFile(username), JSON.stringify(records, null, 2), "utf-8")
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")
  if (!username) {
    return NextResponse.json({ success: false, error: "username required" }, { status: 400 })
  }

  const records = await readPayments(username)
  return NextResponse.json({ success: true, data: records })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, transaction_id, tier, amount, payment_type, reference } = body

    if (!username || !transaction_id) {
      return NextResponse.json({ success: false, error: "username & transaction_id required" }, { status: 400 })
    }

    const records = await readPayments(username)

    const exists = records.some((r: any) => r.transaction_id === transaction_id)
    if (exists) {
      return NextResponse.json({ success: true, data: records })
    }

    const record = {
      transaction_id,
      tier: tier || "basic",
      amount: amount || 0,
      payment_type: payment_type || "qris",
      status: "settled",
      reference: reference || "",
      paid_at: new Date().toISOString(),
    }

    records.push(record)
    await writePayments(username, records)

    return NextResponse.json({ success: true, data: records })
  } catch (err) {
    console.error("payment history error:", err)
    return NextResponse.json({ success: false, error: "Gagal menyimpan history" }, { status: 500 })
  }
}