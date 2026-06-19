// lib/nlp/normalize.ts
// Normalisasi data mentah sebelum masuk pipeline NLP

import type { WeatherRaw } from "./tokenizing"

/**
 * Konversi "jakarta, id" atau "-6.2,106.8" ke nama yang layak tampil.
 * Dipakai sebagai fallback jika xWeather tidak mengembalikan place.name.
 */
export function normalizePlaceName(raw: string): string {
  if (/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(raw.trim())) return raw.trim()
  return raw.split(",")[0].trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Jika xWeather tidak mengembalikan place.name (sering terjadi pada koordinat
 * atau kota kecil), inject nama dari request body agar narasi NLG tidak
 * menampilkan "Tidak diketahui".
 */
export function ensurePlaceName(raw: WeatherRaw, requestLocation: string): WeatherRaw {
  if (raw.place?.name) return raw
  const fallbackName = normalizePlaceName(requestLocation)
  return {
    ...raw,
    place: {
      ...(raw.place ?? {}),
      name: fallbackName,
    },
  }
}