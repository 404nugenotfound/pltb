import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  const clientId = process.env.NEXT_PUBLIC_XWEATHER_CLIENT_ID;
  const clientSecret = process.env.NEXT_PUBLIC_XWEATHER_CLIENT_SECRET;

  // ✅ Pakai data.api.xweather.com bukan api.xweather.com
  const url = `https://data.api.xweather.com/forecasts/${lat},${lng}?client_id=${clientId}&client_secret=${clientSecret}&filter=1hr&limit=168&fields=periods.dateTimeISO,periods.tempC,periods.humidity,periods.windSpeedKPH,periods.windDirDEG`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}