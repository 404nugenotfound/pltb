import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username") || "";
  const res = await fetch("http://127.0.0.1:5000/forecasting_data", {
    cache: "no-store",
    headers: {
      "X-Username": username,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Flask error:", text);
    return NextResponse.json({ error: "Flask error", detail: text }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}