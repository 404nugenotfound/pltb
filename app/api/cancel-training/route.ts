import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";

  const res = await fetch(
    "http://localhost:5000/cancel_training",
    {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
    }
  );

  const data = await res.json();

  return NextResponse.json(data);
}