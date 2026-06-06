import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";

  const res = await fetch("http://localhost:5000/train_progress", {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Flask error", status: res.status }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}