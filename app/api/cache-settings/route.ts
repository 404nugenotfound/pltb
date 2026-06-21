import { NextRequest, NextResponse } from "next/server";

const FLASK_API = "http://localhost:5000";

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username") || "";

    const res = await fetch(`${FLASK_API}/cache_settings`, {
      cache: "no-store",
      headers: {
        "X-Username": username,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Flask returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username") || "";
    const body = await req.json();

    const res = await fetch(`${FLASK_API}/cache_settings`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Username": username,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Flask returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}