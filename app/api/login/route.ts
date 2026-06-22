import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch("http://127.0.0.1:5000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  // Forward Set-Cookie dari Flask ke browser.
  // PENTING: res.headers.get("set-cookie") SELALU balikin null — itu batasan
  // Fetch API spec (Set-Cookie gak bisa diakses lewat .get() biasa), BUKAN
  // soal Flask gak ngirim cookie-nya. Harus pakai getSetCookie() yang
  // balikin array string, baru di-append satu-satu ke response.
  const response = NextResponse.json(data, { status: res.status });
  const setCookies = res.headers.getSetCookie();
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}