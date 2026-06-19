// lib/nlp/tokenizing.ts
// Konversi raw response dari xWeather Conditions Summary API ke token teks terstruktur

export interface WeatherRaw {
  tempC: number
  tempF: number
  feelslikeC: number
  feelslikeF: number
  humidity: number
  weatherPrimary: string
  windSpeedKPH: number
  windSpeedMPH: number
  windDir: string
  windDirDEG: number
  windGustKPH: number
  uvi?: number
  visibilityKM?: number
  pop?: number          // probability of precipitation (%)
  precipMM?: number
  sky?: number          // cloud cover %
  place?: {
    name?: string
    state?: string
    country?: string
  }
}

export interface WeatherToken {
  key: string
  rawValue: number | string
  unit: string
  textToken: string    // token yang siap dipakai NLP
  category: "temperature" | "humidity" | "wind" | "weather" | "uv" | "visibility" | "precipitation" | "location"
}

// ─── Konversi suhu ke token ─────────────────────────────────────────────────

function tokenizeTemperature(raw: WeatherRaw): WeatherToken[] {
  const tokens: WeatherToken[] = []

  tokens.push({
    key: "temp_c",
    rawValue: raw.tempC,
    unit: "°C",
    textToken: `suhu_${raw.tempC.toFixed(1)}c`,
    category: "temperature",
  })

  tokens.push({
    key: "feels_like_c",
    rawValue: raw.feelslikeC,
    unit: "°C",
    textToken: `feels_like_${raw.feelslikeC.toFixed(1)}c`,
    category: "temperature",
  })

  // Klasifikasi suhu ke label teks
  let tempLabel: string
  if (raw.tempC <= 10) tempLabel = "sangat_dingin"
  else if (raw.tempC <= 16) tempLabel = "dingin"
  else if (raw.tempC <= 23) tempLabel = "sejuk"
  else if (raw.tempC <= 30) tempLabel = "hangat"
  else if (raw.tempC <= 35) tempLabel = "panas"
  else tempLabel = "sangat_panas"

  tokens.push({
    key: "temp_label",
    rawValue: raw.tempC,
    unit: "label",
    textToken: tempLabel,
    category: "temperature",
  })

  return tokens
}

// ─── Konversi kelembapan ke token ───────────────────────────────────────────

function tokenizeHumidity(raw: WeatherRaw): WeatherToken[] {
  const tokens: WeatherToken[] = []

  tokens.push({
    key: "humidity_pct",
    rawValue: raw.humidity,
    unit: "%",
    textToken: `humidity_${raw.humidity}pct`,
    category: "humidity",
  })

  let humLabel: string
  if (raw.humidity < 20) humLabel = "sangat_kering"
  else if (raw.humidity < 40) humLabel = "kering"
  else if (raw.humidity < 60) humLabel = "normal"
  else if (raw.humidity < 80) humLabel = "lembap"
  else humLabel = "sangat_lembap"

  tokens.push({
    key: "humidity_label",
    rawValue: raw.humidity,
    unit: "label",
    textToken: humLabel,
    category: "humidity",
  })

  return tokens
}

// ─── Konversi angin ke token ─────────────────────────────────────────────────

function tokenizeWind(raw: WeatherRaw): WeatherToken[] {
  const tokens: WeatherToken[] = []

  tokens.push({
    key: "wind_speed_kph",
    rawValue: raw.windSpeedKPH,
    unit: "km/h",
    textToken: `wind_${raw.windSpeedKPH.toFixed(1)}kph`,
    category: "wind",
  })

  tokens.push({
    key: "wind_dir",
    rawValue: raw.windDir,
    unit: "arah",
    textToken: `wind_dir_${raw.windDir.toLowerCase()}`,
    category: "wind",
  })

  if (raw.windGustKPH > 0) {
    tokens.push({
      key: "wind_gust_kph",
      rawValue: raw.windGustKPH,
      unit: "km/h",
      textToken: `wind_gust_${raw.windGustKPH.toFixed(1)}kph`,
      category: "wind",
    })
  }

  // Skala Beaufort sederhana
  let windLabel: string
  if (raw.windSpeedKPH < 2) windLabel = "tenang"
  else if (raw.windSpeedKPH < 15) windLabel = "sepoi_sepoi"
  else if (raw.windSpeedKPH < 30) windLabel = "angin_ringan"
  else if (raw.windSpeedKPH < 55) windLabel = "angin_sedang"
  else if (raw.windSpeedKPH < 80) windLabel = "angin_kencang"
  else windLabel = "badai"

  tokens.push({
    key: "wind_label",
    rawValue: raw.windSpeedKPH,
    unit: "label",
    textToken: windLabel,
    category: "wind",
  })

  // Terjemahan arah angin ke bahasa Indonesia
  const dirMap: Record<string, string> = {
    N: "utara", NNE: "utara_timurlaut", NE: "timurlaut",
    ENE: "timurlaut_timur", E: "timur", ESE: "tenggara_timur",
    SE: "tenggara", SSE: "selatan_tenggara", S: "selatan",
    SSW: "selatan_baratdaya", SW: "baratdaya", WSW: "baratdaya_barat",
    W: "barat", WNW: "barat_baratlaut", NW: "baratlaut",
    NNW: "utara_baratlaut",
  }

  tokens.push({
    key: "wind_dir_id",
    rawValue: raw.windDir,
    unit: "label_id",
    textToken: `dari_${dirMap[raw.windDir] ?? raw.windDir.toLowerCase()}`,
    category: "wind",
  })

  return tokens
}

// ─── Konversi kondisi cuaca utama ke token ───────────────────────────────────

function tokenizeWeatherCondition(raw: WeatherRaw): WeatherToken[] {
  const tokens: WeatherToken[] = []

  // Normalise weatherPrimary ke slug
  const slug = raw.weatherPrimary.toLowerCase().replace(/\s+/g, "_")
  tokens.push({
    key: "weather_primary",
    rawValue: raw.weatherPrimary,
    unit: "kondisi",
    textToken: `kondisi_${slug}`,
    category: "weather",
  })

  // Cloud cover jika tersedia
  if (raw.sky !== undefined) {
    tokens.push({
      key: "sky_cover_pct",
      rawValue: raw.sky,
      unit: "%",
      textToken: `sky_${raw.sky}pct`,
      category: "weather",
    })
  }

  // PoP (probability of precipitation)
  if (raw.pop !== undefined) {
    tokens.push({
      key: "pop_pct",
      rawValue: raw.pop,
      unit: "%",
      textToken: raw.pop > 0 ? `peluang_hujan_${raw.pop}pct` : "tidak_hujan",
      category: "precipitation",
    })
  }

  if (raw.precipMM !== undefined) {
    tokens.push({
      key: "precip_mm",
      rawValue: raw.precipMM,
      unit: "mm",
      textToken: raw.precipMM > 0 ? `curah_hujan_${raw.precipMM}mm` : "curah_hujan_nol",
      category: "precipitation",
    })
  }

  return tokens
}

// ─── Konversi UV & visibilitas ke token ─────────────────────────────────────

function tokenizeUvAndVisibility(raw: WeatherRaw): WeatherToken[] {
  const tokens: WeatherToken[] = []

  if (raw.uvi !== undefined) {
    tokens.push({
      key: "uvi",
      rawValue: raw.uvi,
      unit: "index",
      textToken: `uvi_${raw.uvi}`,
      category: "uv",
    })

    let uvLabel: string
    if (raw.uvi <= 2) uvLabel = "uv_rendah"
    else if (raw.uvi <= 5) uvLabel = "uv_sedang"
    else if (raw.uvi <= 7) uvLabel = "uv_tinggi"
    else if (raw.uvi <= 10) uvLabel = "uv_sangat_tinggi"
    else uvLabel = "uv_ekstrem"

    tokens.push({
      key: "uv_label",
      rawValue: raw.uvi,
      unit: "label",
      textToken: uvLabel,
      category: "uv",
    })
  }

  if (raw.visibilityKM !== undefined) {
    tokens.push({
      key: "visibility_km",
      rawValue: raw.visibilityKM,
      unit: "km",
      textToken: `visibilitas_${raw.visibilityKM}km`,
      category: "visibility",
    })

    const visLabel =
      raw.visibilityKM >= 10
        ? "jarak_pandang_baik"
        : raw.visibilityKM >= 5
          ? "jarak_pandang_sedang"
          : "jarak_pandang_buruk"

    tokens.push({
      key: "visibility_label",
      rawValue: raw.visibilityKM,
      unit: "label",
      textToken: visLabel,
      category: "visibility",
    })
  }

  return tokens
}

// ─── Konversi lokasi ke token ────────────────────────────────────────────────

function tokenizeLocation(raw: WeatherRaw): WeatherToken[] {
  if (!raw.place) return []
  const { name, state, country } = raw.place
  const slug = [name, state, country]
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/\s+/g, "_")

  return [
    {
      key: "location",
      rawValue: slug,
      unit: "lokasi",
      textToken: `lokasi_${slug}`,
      category: "location",
    },
  ]
}

// ─── MAIN TOKENIZER ──────────────────────────────────────────────────────────

/**
 * Tokenize seluruh data cuaca dari xWeather API menjadi array WeatherToken.
 * Setiap token berisi: key, rawValue, unit, textToken (untuk NLP), dan category.
 */
export function tokenizeWeather(raw: WeatherRaw): WeatherToken[] {
  return [
    ...tokenizeTemperature(raw),
    ...tokenizeHumidity(raw),
    ...tokenizeWind(raw),
    ...tokenizeWeatherCondition(raw),
    ...tokenizeUvAndVisibility(raw),
    ...tokenizeLocation(raw),
  ]
}

/**
 * Kembalikan hanya textToken sebagai flat array string.
 * Berguna untuk input ke stemming / NLP berikutnya.
 */
export function getTextTokens(raw: WeatherRaw): string[] {
  return tokenizeWeather(raw).map((t) => t.textToken)
}

/**
 * Kembalikan token yang difilter berdasarkan category.
 */
export function getTokensByCategory(
  raw: WeatherRaw,
  category: WeatherToken["category"]
): WeatherToken[] {
  return tokenizeWeather(raw).filter((t) => t.category === category)
}