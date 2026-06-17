import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const username = req.nextUrl.searchParams.get("username") || "";

  const res = await fetch(`http://127.0.0.1:5000/snapshots/${params.id}/restore`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "X-Username": username,
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}