// app/api/analytics/nlp/route.ts
// Next.js App Router — POST /api/analytics/nlp
// Pipeline: xWeather API → processWeatherNlp (8 stage NLP) → Response

import { NextRequest, NextResponse } from "next/server"
import { processWeatherNlp, type PipelineResult } from "@/lib/nlp/pipeline"
import { calcFixtureAccuracy } from "@/lib/nlp/fixture-accuracy"
import { ensurePlaceName, normalizePlaceName } from "@/lib/nlp/normalize"
import { type WeatherRaw } from "@/lib/nlp/tokenizing"

// ─── Konfigurasi xWeather ────────────────────────────────────────────────────

const XWEATHER_BASE = "https://data.api.xweather.com"
const CLIENT_ID = process.env.XWEATHER_CLIENT_ID ?? process.env.NEXT_PUBLIC_XWEATHER_CLIENT_ID ?? ""
const CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET ?? process.env.NEXT_PUBLIC_XWEATHER_CLIENT_SECRET ?? ""

// ─── Tipe request body ───────────────────────────────────────────────────────

interface NlpRequestBody {  
  location: string
  action?: string
  dateISO?: string
}

// ─── Tipe response ───────────────────────────────────────────────────────────

interface NlpResponse {
  success: boolean
  location: string
  pipeline: PipelineResult["pipeline"]
  testAccuracy?: {
    passed: number
    total: number
    score: number
  }
  error?: string
}

// ─── Fetch xWeather ─────────────────────────────────────────────────────────

async function fetchWeatherData(location: string, dateISO?: string): Promise<WeatherRaw> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("XWEATHER_CLIENT_ID dan XWEATHER_CLIENT_SECRET belum diset di environment variables.")
  }

  const auth = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  const fields = [
    "tempC", "tempF", "feelslikeC", "feelslikeF",
    "humidity", "weatherPrimary",
    "windSpeedKPH", "windSpeedMPH", "windDir", "windDirDEG", "windGustKPH",
    "uvi", "visibilityKM", "pop", "precipMM", "sky", "place",
  ].join(",")

  if (dateISO) {
    const today = new Date().toISOString().split("T")[0]
    if (dateISO > today) {
      try {
        const encodedLoc = encodeURIComponent(location)
        const forecastUrl = `${XWEATHER_BASE}/forecasts/${encodedLoc}?filter=day&limit=7&fields=periods.dateTimeISO,periods.maxTempC,periods.minTempC,periods.tempC,periods.feelslikeC,periods.humidity,periods.weatherPrimary,periods.windSpeedKPH,periods.windSpeedMPH,periods.windDir,periods.windDirDEG,periods.windGustKPH,periods.uvi,periods.visibilityKM,periods.pop,periods.precipMM,periods.sky&${auth}`
        console.log("[NLP API] forecast for date:", forecastUrl.replace(CLIENT_SECRET, "***"))

        const res = await fetch(forecastUrl, { next: { revalidate: 300 } })
        const json = await res.json()

        if (json.success) {
          const periods = json.response?.[0]?.periods
          const place = json.response?.[0]?.place
          if (periods) {
            const targetPeriod = (periods as any[]).find((p: any) => p.dateTimeISO?.startsWith(dateISO))
            if (targetPeriod) {
              return {
                tempC: targetPeriod.maxTempC ?? targetPeriod.minTempC ?? 0,
                tempF: targetPeriod.maxTempF ?? 0,
                feelslikeC: targetPeriod.feelslikeC ?? targetPeriod.maxTempC ?? 0,
                feelslikeF: targetPeriod.feelslikeF ?? 0,
                humidity: targetPeriod.humidity ?? 0,
                weatherPrimary: targetPeriod.weatherPrimary ?? "",
                windSpeedKPH: targetPeriod.windSpeedMaxKPH ?? targetPeriod.windSpeedKPH ?? 0,
                windSpeedMPH: targetPeriod.windSpeedMaxMPH ?? targetPeriod.windSpeedMPH ?? 0,
                windDir: targetPeriod.windDir ?? "N",
                windDirDEG: targetPeriod.windDirDEG ?? 0,
                windGustKPH: targetPeriod.windGustKPH ?? 0,
                uvi: targetPeriod.uvi ?? undefined,
                visibilityKM: targetPeriod.visibilityKM ?? undefined,
                pop: targetPeriod.pop ?? undefined,
                precipMM: targetPeriod.precipMM ?? undefined,
                sky: targetPeriod.sky ?? undefined,
                place,
              }
            }
          }
        }
      } catch (e) {
        console.log("[NLP API] forecast for date error:", e)
      }
    }
  }

  // Percobaan 1: conditions/summary
  try {
    const encodedLoc = encodeURIComponent(location)
    const url = `${XWEATHER_BASE}/conditions/summary/${encodedLoc}?${auth}&fields=${fields}`
    console.log("[NLP API] conditions/summary:", url.replace(CLIENT_SECRET, "***"))

    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json()

    if (json.success) {
      const ob = json.response?.[0]?.ob
      const place = json.response?.[0]?.place
      if (ob?.tempC !== undefined) return { ...ob, place }

      const period = json.response?.[0]?.periods?.[0]
      if (period?.tempC !== undefined) return { ...period, place }
    }
  } catch (e) {
    console.log("[NLP API] conditions/summary error:", e)
  }

  // Percobaan 2: observations/closest
  try {
    const encodedLoc = encodeURIComponent(location)
    const url = `${XWEATHER_BASE}/observations/closest?p=${encodedLoc}&limit=1&${auth}&fields=${fields}`
    console.log("[NLP API] observations/closest:", url.replace(CLIENT_SECRET, "***"))

    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json()

    if (json.success) {
      const ob = json.response?.[0]?.ob
      const place = json.response?.[0]?.place
      if (ob?.tempC !== undefined) return { ...ob, place }
    }
  } catch (e) {
    console.log("[NLP API] observations/closest error:", e)
  }

  // Percobaan 3: forecasts fallback
  try {
    const encodedLoc = encodeURIComponent(location)
    const url = `${XWEATHER_BASE}/forecasts/${encodedLoc}?filter=day&limit=1&fields=periods.dateTimeISO,periods.maxTempC,periods.minTempC,periods.tempC,periods.feelslikeC,periods.humidity,periods.weatherPrimary,periods.windSpeedKPH,periods.windSpeedMPH,periods.windDir,periods.windDirDEG,periods.windGustKPH,periods.uvi,periods.visibilityKM,periods.pop,periods.precipMM,periods.sky&${auth}`
    console.log("[NLP API] forecasts fallback:", url.replace(CLIENT_SECRET, "***"))

    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json()

    if (json.success) {
      const period = json.response?.[0]?.periods?.[0]
      const place = json.response?.[0]?.place
      if (period) {
        return {
          tempC: period.maxTempC ?? period.minTempC ?? 0,
          tempF: period.maxTempF ?? 0,
          feelslikeC: period.feelslikeC ?? period.maxTempC ?? 0,
          feelslikeF: period.feelslikeF ?? 0,
          humidity: period.humidity ?? 0,
          weatherPrimary: period.weatherPrimary ?? "",
          windSpeedKPH: period.windSpeedMaxKPH ?? period.windSpeedKPH ?? 0,
          windSpeedMPH: period.windSpeedMaxMPH ?? period.windSpeedMPH ?? 0,
          windDir: period.windDir ?? "N",
          windDirDEG: period.windDirDEG ?? 0,
          windGustKPH: period.windGustKPH ?? 0,
          uvi: period.uvi ?? undefined,
          visibilityKM: period.visibilityKM ?? undefined,
          pop: period.pop ?? undefined,
          precipMM: period.precipMM ?? undefined,
          sky: period.sky ?? undefined,
          place,
        }
      }
    }
  } catch (e) {
    console.log("[NLP API] forecasts fallback error:", e)
  }

  throw new Error("Tidak dapat mengambil data cuaca dari semua endpoint xWeather.")
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<NlpResponse>> {
  try {
    const body: NlpRequestBody = await req.json()

    if (!body.location) {
      return NextResponse.json(
        { success: false, location: "", pipeline: {} as NlpResponse["pipeline"], error: "Parameter 'location' wajib diisi." },
        { status: 400 }
      )
    }

    // ── Fetch + normalize ──────────────────────────────────────────────────
    let raw = await fetchWeatherData(body.location, body.dateISO)
    raw = ensurePlaceName(raw, body.location)

    // ── Pipeline NLP (8 stage) ────────────────────────────────────────────
    const result = processWeatherNlp(raw, body.dateISO)

    const testAccuracy = calcFixtureAccuracy()

    return NextResponse.json({
      success: true,
      location: result.pipeline.step1_raw.place?.name ?? "tidak diketahui",
      pipeline: result.pipeline,
      testAccuracy: { passed: testAccuracy.passed, total: testAccuracy.total, score: testAccuracy.score },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan tidak dikenal."
    console.error("[NLP API]", message)
    return NextResponse.json(
      { success: false, location: "", pipeline: {} as NlpResponse["pipeline"], error: message },
      { status: 500 }
    )
  }
}

// ─── GET: health check ───────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    endpoint: "POST /api/analytics/nlp",
    pipeline: [
      "step1: xWeather fetch",
      "step2: tokenizing",
      "step3: stemming",
      "step3a: feature extraction (n-gram, TF-IDF)",
      "step3b: reasoning engine (cross-concept rules)",
      "step4: NLG",
      "step5: sentiment analysis",
      "step6: highlights",
    ],
    requiredBody: { location: "string (koordinat 'lat,lng' atau nama kota)", dateISO: "string opsional (misal '2025-05-27')" },
    envRequired: ["XWEATHER_CLIENT_ID", "XWEATHER_CLIENT_SECRET"],
  })
}