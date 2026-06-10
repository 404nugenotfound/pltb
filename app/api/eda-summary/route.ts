import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const res = await fetch("http://127.0.0.1:5000/eda_summary", {
    cache: "no-store",
    headers: { cookie },
  });
  const data = await res.json();
  return NextResponse.json(data);
}