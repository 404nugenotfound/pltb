import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username") || "";
  const cookie = req.headers.get("cookie") || "";
  const res = await fetch(`${process.env.PYTHON_API_URL}/cancel_generate`, {
    method: "POST",
    headers: { 
      "X-Username": username,
      "cookie": cookie,  // ← tambah ini
    },
  });
  const data = await res.json();
  return NextResponse.json(data);
}