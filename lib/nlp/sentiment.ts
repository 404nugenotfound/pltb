// lib/nlp/sentiment.ts
// Sentiment Analysis — hitung breakdown & tone dari StemmedWeather

import type { StemmedWeather } from "./stemming"

export interface SentimentResult {
  label: StemmedWeather["overallSentiment"]
  score: number
  tone: string
  breakdown: {
    positif: number
    netral: number
    waspada: number
    berbahaya: number
  }
}

function seedFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length]
}

const TONE_ARRAYS: Record<StemmedWeather["overallSentiment"], string[]> = {
  baik: [
    "Positif — cuaca mendukung aktivitas normal",
    "Langit bersahabat, aktivitas lancar tanpa hambatan berarti",
    "Semua indikator cuaca menunjukkan kondisi yang nyaman dan aman",
    "Cuaca sedang ramah — tidak ada yang perlu dikhawatirkan",
    "Hari yang baik untuk keluar, langit dan angin mendukung penuh",
    "Kondisi optimal, semua parameter cuaca ada di zona hijau",
    "Tenang dan stabil — cuaca sedang berpihak padamu",
    "Tidak ada gangguan cuaca yang berarti, nikmati harimu",
  ],
  cukup: [
    "Netral — kondisi dapat diterima dengan sedikit catatan",
    "Cuaca standar, tidak istimewa tapi tidak mengkhawatirkan",
    "Beberapa parameter sedikit bergeser, tapi masih dalam batas aman",
    "Kondisi cukup lumayan, aktivitas ringan tetap bisa dilakukan",
    "Cuaca biasa saja — ada yang kurang ideal, tapi risikonya kecil",
    "Tidak perlu khawatir berlebihan, tapi tetap perhatikan sekeliling",
    "Kondisi masih dalam batas wajar, dengan beberapa catatan kecil",
    "Hari yang biasa, tidak ada yang ekstrem — tetap waspada wajar",
  ],
  waspada: [
    "Waspada — beberapa parameter cuaca memerlukan perhatian",
    "Ada tanda-tanda yang perlu diamati sebelum beraktivitas di luar",
    "Cuaca tidak sepenuhnya bersahabat, periksa kondisi sebelum keluar",
    "Beberapa indikator menunjukkan potensi risiko ringan hingga sedang",
    "Perlu kewaspadaan ekstra, beberapa parameter cuaca kurang ideal",
    "Tidak berbahaya, tapi ada beberapa hal yang perlu diantisipasi",
    "Cuaca sedikit menantang — tetap siaga dan jangan lengah",
    "Risiko rendah hingga sedang terdeteksi, perhatikan sekeliling",
  ],
  berbahaya: [
    "Negatif — kondisi ekstrem, aktivitas outdoor tidak disarankan",
    "Situasi cuaca cukup serius, tunda aktivitas luar ruangan jika tidak mendesak",
    "Cuaca tidak bersahabat — prioritas utama adalah keselamatan",
    "Risiko tinggi terdeteksi, disarankan tetap di dalam ruangan",
    "Beberapa parameter cuaca mencapai level berbahaya, jangan ambil risiko",
    "Peringatan: kondisi luar ruangan tidak aman untuk aktivitas apa pun",
    "Cuaca ekstrem teridentifikasi — lebih baik aman daripada menyesal",
    "Hari ini alam sedang tidak berpihak, tunda semua rencana outdoor",
  ],
}

export function largestRemainderPct(counts: Record<string, number>, total: number): Record<string, number> {
  const keys = Object.keys(counts)
  const rawPct = keys.map((k) => ({ key: k, value: (counts[k] / total) * 100 }))
  let floorSum = 0
  const floored = rawPct.map((r) => {
    const f = Math.floor(r.value)
    floorSum += f
    return { key: r.key, floor: f, remainder: r.value - f }
  })
  let remainder = 100 - floorSum
  floored.sort((a, b) => b.remainder - a.remainder)
  const result: Record<string, number> = {}
  for (const f of floored) {
    result[f.key] = f.floor + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--
  }
  return result
}

export function analyzeSentiment(stemmed: StemmedWeather): SentimentResult {
  const total = stemmed.concepts.length || 1
  const counts = {
    positif: stemmed.concepts.filter(c => c.sentiment === "positif").length,
    netral: stemmed.concepts.filter(c => c.sentiment === "netral").length,
    waspada: stemmed.concepts.filter(c => c.sentiment === "waspada").length,
    berbahaya: stemmed.concepts.filter(c => c.sentiment === "berbahaya").length,
  }

  const pct = largestRemainderPct(counts, total)

  const seed = seedFromString(stemmed.location + stemmed.overallSentiment + stemmed.overallScore)
  const toneArray = TONE_ARRAYS[stemmed.overallSentiment]

  return {
    label: stemmed.overallSentiment,
    score: stemmed.overallScore,
    tone: pick(toneArray, seed, 0) + ".",
    breakdown: {
      positif: pct.positif,
      netral: pct.netral,
      waspada: pct.waspada,
      berbahaya: pct.berbahaya,
    },
  }
}