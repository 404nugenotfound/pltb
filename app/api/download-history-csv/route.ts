import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username") || "";
  const file = req.nextUrl.searchParams.get("file") || "";

  const res = await fetch(
    `${process.env.PYTHON_API_URL}/download_history_csv?file=${encodeURIComponent(file)}`,
    {
      headers: { "X-Username": username },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  const blob = await res.blob();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}