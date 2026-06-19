// lib/nlp/stemming.ts
// Pemetaan token cuaca ke konsep yang dinormalisasi — siap dipakai text summarization & sentiment

import type { WeatherToken } from "./tokenizing"

// ─── Tipe output stemming ────────────────────────────────────────────────────

export interface StemmedConcept {
  concept: string           // konsep ternormalisasi (misal: "panas_sedang")
  sentiment: "positif" | "netral" | "waspada" | "berbahaya"
  weight: number            // bobot kontribusi ke skor keseluruhan (0–1)
  humanLabel: string        // label bahasa Indonesia untuk narasi
  advice: string            // saran singkat terkait kondisi ini
}

export interface StemmedWeather {
  concepts: StemmedConcept[]
  overallSentiment: "baik" | "cukup" | "waspada" | "berbahaya"
  overallScore: number      // 0 (berbahaya) – 100 (sempurna)
  location: string
}

// ─── Map: textToken → StemmedConcept ────────────────────────────────────────
// Setiap token dari tokenizing.ts dipetakan ke konsep yang lebih ringkas.

const TOKEN_CONCEPT_MAP: Record<string, Omit<StemmedConcept, "concept">> = {
  // Suhu
  // FIX: sangat_dingin → berbahaya (sebelumnya waspada), weight 0.15 (sebelumnya 0.3)
  sangat_dingin: { sentiment: "berbahaya", weight: 0.15, humanLabel: "Dingin menusuk tulang", advice: "Jaket tebal dan syal bukan lagi pilihan, tapi kebutuhan." },
  dingin: { sentiment: "netral", weight: 0.7, humanLabel: "Udara dingin terasa", advice: "Sebaiknya pakai jaket atau sweater tipis kalau keluar." },
  sejuk: { sentiment: "positif", weight: 1.0, humanLabel: "Udara sejuk dan segar", advice: "Cuaca nyaman banget buat jalan-jalan atau olahraga ringan." },
  hangat: { sentiment: "positif", weight: 0.9, humanLabel: "Hangat bersahabat", advice: "Cuaca enak, tapi jangan lupa minum cukup." },
  panas: { sentiment: "waspada", weight: 0.4, humanLabel: "Panas menyengat", advice: "Hindari terik langsung siang hari, perbanyak istirahat di tempat teduh." },
  sangat_panas: { sentiment: "berbahaya", weight: 0.2, humanLabel: "Panas ekstrem berbahaya", advice: "Jangan paksakan aktivitas outdoor, risiko heat stroke sangat nyata." },

  // Kelembapan
  // FIX: sangat_kering → berbahaya (sebelumnya waspada), weight 0.2 (sebelumnya 0.45)
  sangat_kering: { sentiment: "berbahaya", weight: 0.2, humanLabel: "Udara kering luar biasa", advice: "Kulit dan tenggorokan cepat kering — pelembap dan air putih jadi senjata utama." },
  kering: { sentiment: "netral", weight: 0.7, humanLabel: "Udara agak kering", advice: "Minum lebih banyak dari biasanya, udara menarik cairan dari tubuh." },
  normal: { sentiment: "positif", weight: 1.0, humanLabel: "Kelembapan udara pas", advice: "Udara nyaman di kulit, nggak gerah nggak kering." },
  lembap: { sentiment: "netral", weight: 0.65, humanLabel: "Udara terasa lembap", advice: "Baju mungkin terasa sedikit lengket, tapi masih nyaman." },
  sangat_lembap: { sentiment: "waspada", weight: 0.4, humanLabel: "Udara gerah dan berat", advice: "Waspada jamur di rumah dan dehidrasi yang nggak terasa." },

  // Angin
  tenang: { sentiment: "positif", weight: 1.0, humanLabel: "Angin tenang, udara hening", advice: "Tidak ada gangguan angin — kondisi tenang dan damai." },
  sepoi_sepoi: { sentiment: "positif", weight: 1.0, humanLabel: "Angin sepoi-sepoi basa", advice: "Angin ringan menerpa, terasa segar dan menenangkan." },
  angin_ringan: { sentiment: "positif", weight: 0.9, humanLabel: "Angin ringan bersahabat", advice: "Kondisi outdoor nyaman, angin sejuk mengiringi." },
  angin_sedang: { sentiment: "netral", weight: 0.7, humanLabel: "Angin lumayan kencang", advice: "Barang-barang ringan di luar ruangan perlu diamankan." },
  angin_kencang: { sentiment: "waspada", weight: 0.35, humanLabel: "Angin kencang menerpa", advice: "Hindari berteduh di bawah pohon besar atau papan reklame." },
  badai: { sentiment: "berbahaya", weight: 0.1, humanLabel: "Badai angin berbahaya", advice: "Tetap di dalam ruangan, jauhi jendela dan ikuti info resmi." },

  // Kondisi cuaca (weather primary)
  "kondisi_sunny": { sentiment: "positif", weight: 1.0, humanLabel: "Langit cerah bersinar", advice: "Hari yang cerah — waktu yang pas untuk jemur baju atau piknik." },
  "kondisi_mostly_sunny": { sentiment: "positif", weight: 1.0, humanLabel: "Cerah dengan sedikit awan", advice: "Sebagian besar cerah, nyaman untuk segala aktivitas." },
  "kondisi_partly_cloudy": { sentiment: "positif", weight: 0.9, humanLabel: "Berawan sebagian", advice: "Cuaca bervariasi, kalau bepergian jauh bawa jaket tipis." },
  "kondisi_mostly_cloudy": { sentiment: "netral", weight: 0.75, humanLabel: "Langit didominasi awan", advice: "Cahaya matahari terbatas, tapi aktivitas outdoor tetap aman." },
  "kondisi_cloudy": { sentiment: "netral", weight: 0.65, humanLabel: "Mendung merata", advice: "Langit kelabu — mending siapkan payung dari sekarang." },
  "kondisi_overcast": { sentiment: "netral", weight: 0.45, humanLabel: "Langit tertutup awan tebal", advice: "Jangan lupa payung, peluang hujan meningkat." },
  "kondisi_rain": { sentiment: "waspada", weight: 0.35, humanLabel: "Hujan turun", advice: "Payung atau jas hujan wajib — jalanan juga bakal licin." },
  "kondisi_heavy_rain": { sentiment: "berbahaya", weight: 0.15, humanLabel: "Hujan deras mengguyur", advice: "Hindari keluar kalau nggak urgent, waspada banjir di tempat rendah." },
  "kondisi_thunderstorm": { sentiment: "berbahaya", weight: 0.1, humanLabel: "Badai petir mengancam", advice: "Jangan berteduh di bawah pohon, hindari area terbuka." },
  "kondisi_snow": { sentiment: "waspada", weight: 0.35, humanLabel: "Salju turun", advice: "Pakai pakaian hangat berlapis, jalanan licin ekstra hati-hati." },
  "kondisi_fog": { sentiment: "waspada", weight: 0.35, humanLabel: "Kabut tebal menyelimuti", advice: "Kurangi kecepatan berkendara, nyalakan lampu kabut." },
  "kondisi_haze": { sentiment: "waspada", weight: 0.35, humanLabel: "Kabut tipis atau asap", advice: "Cek kualitas udara, gunakan masker kalau perlu." },
  "kondisi_clear": { sentiment: "positif", weight: 1.0, humanLabel: "Langit bersih total", advice: "Kondisi ideal untuk apa pun — olahraga, jalan-jalan, jemuran." },
  "kondisi_drizzle": { sentiment: "netral", weight: 0.6, humanLabel: "Gerimis tipis", advice: "Gerimis aja sih, tapi payung kecil tetap berguna." },
  "kondisi_light_rain": { sentiment: "netral", weight: 0.6, humanLabel: "Hujan ringan", advice: "Hujan ringan — payung atau jas hujan tetap perlu." },
  "kondisi_light_rain_showers": { sentiment: "netral", weight: 0.55, humanLabel: "Gerimis singkat", advice: "Hujan ringan sebentar saja, masih aman untuk aktivitas." },

  // UV
  uv_rendah: { sentiment: "positif", weight: 1.0, humanLabel: "Sinar UV rendah", advice: "Aman tanpa tabir surya untuk aktivitas singkat." },
  uv_sedang: { sentiment: "netral", weight: 0.8, humanLabel: "UV sedang", advice: "Pakai SPF 30+ kalau beraktivitas lebih dari 30 menit di luar." },
  uv_tinggi: { sentiment: "waspada", weight: 0.5, humanLabel: "UV tinggi, perlu waspada", advice: "Tabir surya SPF 50+ wajib, topi dan kacamata hitam jadi pelengkap." },
  uv_sangat_tinggi: { sentiment: "waspada", weight: 0.3, humanLabel: "UV sangat tinggi", advice: "Hindari keluar jam 10 pagi sampai 4 sore kalau nggak penting." },
  uv_ekstrem: { sentiment: "berbahaya", weight: 0.1, humanLabel: "UV ekstrem, bahaya kulit", advice: "Paparan matahari berbahaya — lebih baik bertahan di dalam ruangan." },

  // Visibilitas
  jarak_pandang_baik: { sentiment: "positif", weight: 1.0, humanLabel: "Jarak pandang bersih", advice: "Kondisi berkendara aman, visibilitas optimal." },
  jarak_pandang_sedang: { sentiment: "netral", weight: 0.6, humanLabel: "Visibilitas agak terbatas", advice: "Kurangi kecepatan—jalanan tidak sejelas biasanya." },
  jarak_pandang_buruk: { sentiment: "waspada", weight: 0.3, humanLabel: "Kabut batasi pandangan", advice: "Jarak pandang sangat terbatas — kalau bisa tunda perjalanan." },

  // Hujan
  tidak_hujan: { sentiment: "positif", weight: 1.0, humanLabel: "Langit kering", advice: "Tidak ada hujan — aman untuk aktivitas luar ruangan." },
  curah_hujan_nol: { sentiment: "positif", weight: 1.0, humanLabel: "Nol curah hujan", advice: "Tidak ada hujan terdeteksi, silakan beraktivitas dengan tenang." },

  // FIX: Arah angin — mapping dari wind_dir_id token (key: "wind_dir_id")
  // Format token: "dari_<arah>" sesuai dirMap di tokenizing.ts
  "dari_utara":             { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari utara", advice: "Angin utara membawa udara lebih sejuk." },
  "dari_timurlaut":         { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari timur laut", advice: "Arah angin timur laut, kondisi normal." },
  "dari_timur":             { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari timur", advice: "Angin timur, cuaca cenderung stabil." },
  "dari_tenggara":          { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari tenggara", advice: "Arah angin tenggara, pantau cuaca." },
  "dari_selatan":           { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari selatan", advice: "Angin selatan, pantau kelembapan udara." },
  "dari_baratdaya":         { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari barat daya", advice: "Arah angin barat daya, waspada hujan." },
  "dari_barat":             { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari barat", advice: "Angin barat, potensi awan meningkat." },
  "dari_baratlaut":         { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari barat laut", advice: "Arah angin barat laut, udara sejuk." },
  "dari_utara_timurlaut":   { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari utara-timur laut", advice: "Kondisi angin normal." },
  "dari_timurlaut_timur":   { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari timur laut-timur", advice: "Kondisi angin stabil." },
  "dari_tenggara_timur":    { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari tenggara-timur", advice: "Pantau kondisi cuaca." },
  "dari_selatan_tenggara":  { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari selatan-tenggara", advice: "Pantau kelembapan udara." },
  "dari_selatan_baratdaya": { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari selatan-barat daya", advice: "Waspada potensi hujan." },
  "dari_baratdaya_barat":   { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari barat daya-barat", advice: "Angin membawa potensi hujan." },
  "dari_barat_baratlaut":   { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari barat-barat laut", advice: "Udara sejuk dari barat." },
  "dari_utara_baratlaut":   { sentiment: "netral", weight: 0.75, humanLabel: "Angin dari utara-barat laut", advice: "Angin sejuk dari utara." },
}

// ─── Penalty multiplier per sentiment ────────────────────────────────────────
// FIX: Ganti rata-rata biasa → weighted penalty agar kondisi berbahaya
// tidak "diselamatkan" oleh konsep positif lain (misal uv_rendah atau tenang)

const SENTIMENT_PENALTY: Record<string, number> = {
  positif:   1.0,
  netral:    0.8,
  waspada:   0.45,   // turun signifikan dari 0.65
  berbahaya: 0.15,   // penalti berat dari 0.25
}

// ─── Stemmer untuk label suhu (berdasarkan nilai numerik) ────────────────────

function stemTemperatureTokens(tokens: WeatherToken[]): StemmedConcept[] {
  return tokens
    .filter((t) => t.category === "temperature" && t.key === "temp_label")
    .map((t) => {
      const map = TOKEN_CONCEPT_MAP[t.textToken]
      if (!map) return null
      return { concept: t.textToken, ...map }
    })
    .filter(Boolean) as StemmedConcept[]
}

// ─── Stemmer umum: lookup TOKEN_CONCEPT_MAP ──────────────────────────────────

function stemByMap(tokens: WeatherToken[], keyFilter: string): StemmedConcept[] {
  return tokens
    .filter((t) => t.key === keyFilter)
    .map((t) => {
      const map = TOKEN_CONCEPT_MAP[t.textToken]
      if (!map) return null
      return { concept: t.textToken, ...map }
    })
    .filter(Boolean) as StemmedConcept[]
}

// ─── Stemmer kondisi cuaca utama ─────────────────────────────────────────────

function stemWeatherCondition(tokens: WeatherToken[]): StemmedConcept[] {
  return tokens
    .filter((t) => t.key === "weather_primary")
    .map((t) => {
      const map = TOKEN_CONCEPT_MAP[t.textToken]
      // Fallback: kondisi tidak dikenal → netral
      if (!map) {
        return {
          concept: t.textToken,
          sentiment: "netral" as const,
          weight: 0.7,
          humanLabel: t.rawValue as string,
          advice: "Perhatikan perkembangan cuaca setempat.",
        }
      }
      return { concept: t.textToken, ...map }
    })
}

// ─── Stemmer peluang hujan ───────────────────────────────────────────────────

function stemPrecipitation(tokens: WeatherToken[]): StemmedConcept[] {
  const popToken = tokens.find((t) => t.key === "pop_pct")
  if (!popToken) return []

  const pop = Number(popToken.rawValue)
  let concept: string, sentiment: StemmedConcept["sentiment"], advice: string, humanLabel: string

  if (pop === 0) {
    concept = "tidak_hujan"; sentiment = "positif"
    humanLabel = "Langit cerah, nol peluang hujan"; advice = "Payung bisa ditinggal, hari ini aman."
  } else if (pop <= 20) {
    concept = "peluang_hujan_kecil"; sentiment = "netral"
    humanLabel = `Peluang hujan kecil (${pop}%)`; advice = "Kemungkinan kecil hujan — payung opsional, tergantung feeling."
  } else if (pop <= 50) {
    concept = "peluang_hujan_sedang"; sentiment = "netral"
    humanLabel = `Peluang hujan lumayan (${pop}%)`; advice = "Mending bawa payung deh, daripada kehujanan di tengah jalan."
  } else if (pop <= 80) {
    concept = "kemungkinan_hujan"; sentiment = "waspada"
    humanLabel = `Berpotensi hujan (${pop}%)`; advice = "Siapkan payung atau jas hujan, peluangnya cukup besar."
  } else {
    concept = "hampir_pasti_hujan"; sentiment = "waspada"
    humanLabel = `Hujan nyaris pasti (${pop}%)`; advice = "Perlengkapan hujan lengkap wajib — kalau bisa tunda perjalanan."
  }

  return [{ concept, sentiment, weight: 1 - pop / 100, humanLabel, advice }]
}

// ─── Hitung skor & sentimen keseluruhan ─────────────────────────────────────
// FIX: Ganti formula rata-rata biasa → weighted penalty
// Skor sekarang memperhitungkan tingkat bahaya tiap konsep,
// bukan hanya rata-rata weight mentah

function calcOverall(concepts: StemmedConcept[]): Pick<StemmedWeather, "overallSentiment" | "overallScore"> {
  if (concepts.length === 0) return { overallSentiment: "baik", overallScore: 100 }

  // Hitung skor dengan penalti berbasis sentimen
  const weightedSum = concepts.reduce((s, c) => {
    const penalty = SENTIMENT_PENALTY[c.sentiment] ?? 1.0
    return s + c.weight * penalty
  }, 0)

  const score = Math.round((weightedSum / concepts.length) * 100)

  // Hitung distribusi sentimen
  const counts = { positif: 0, netral: 0, waspada: 0, berbahaya: 0 }
  concepts.forEach((c) => counts[c.sentiment]++)

  const hasBerbahaya = counts.berbahaya > 0
  const waspadaRatio = counts.waspada / concepts.length

  // FIX: Threshold lebih sensitif — threshold waspada turun dari 0.5 → 0.3
  // dan tambahkan kondisi score < 25 / < 45 sebagai fallback
  let overallSentiment: StemmedWeather["overallSentiment"]
  if (hasBerbahaya || score < 25)              overallSentiment = "berbahaya"
  else if (waspadaRatio >= 0.3 || score < 45)  overallSentiment = "waspada"
  else if (score >= 80)                         overallSentiment = "baik"
  else                                          overallSentiment = "cukup"

  return { overallSentiment, overallScore: score }
}

// ─── MAIN STEMMER ────────────────────────────────────────────────────────────

/**
 * Terima array WeatherToken dari tokenizeWeather(), kembalikan StemmedWeather
 * yang berisi konsep ternormalisasi, sentimen, skor, dan saran per kondisi.
 *
 * FIX: Tambahkan slot ke-8 → wind_dir_id (arah angin dalam Bahasa Indonesia)
 * sebelumnya pakai "wind_direction_label" yang tidak exist di tokenizing.ts
 */
export function stemWeather(tokens: WeatherToken[]): StemmedWeather {
  const concepts: StemmedConcept[] = [
    ...stemTemperatureTokens(tokens),              // 1. suhu
    ...stemByMap(tokens, "humidity_label"),         // 2. kelembapan
    ...stemByMap(tokens, "wind_label"),             // 3. kecepatan angin
    ...stemWeatherCondition(tokens),                // 4. kondisi cuaca utama
    ...stemByMap(tokens, "uv_label"),               // 5. UV index
    ...stemByMap(tokens, "visibility_label"),        // 6. visibilitas
    ...stemPrecipitation(tokens),                   // 7. peluang hujan
    ...stemByMap(tokens, "wind_dir_id"),            // 8. FIX: arah angin (key benar dari tokenizing.ts)
  ]

  const locationToken = tokens.find((t) => t.category === "location")
  const location = locationToken
    ? (locationToken.rawValue as string).replace(/_/g, ", ")
    : "tidak diketahui"

  return {
    concepts,
    location,
    ...calcOverall(concepts),
  }
}

/**
 * Utiliti: kembalikan hanya daftar saran unik dari semua konsep.
 */
export function getAdviceList(stemmed: StemmedWeather): string[] {
  return [...new Set(stemmed.concepts.map((c) => c.advice))]
}

/**
 * Utiliti: kembalikan konsep yang memiliki sentimen tertentu.
 */
export function getConceptsBySentiment(
  stemmed: StemmedWeather,
  sentiment: StemmedConcept["sentiment"]
): StemmedConcept[] {
  return stemmed.concepts.filter((c) => c.sentiment === sentiment)
}