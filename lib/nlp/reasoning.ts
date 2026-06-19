// lib/nlp/reasoning.ts
// Reasoning Engine — Rule-Based Expert System
// Input : StemmedConcept[] dari stemming.ts
// Output: ReasoningResult dengan derived insights, adjusted score, priority ranking
//
// Algoritma:
//   1. Detect cross-concept combinations dari 20+ rule
//   2. Adjusted scoring dengan boost/penalty dari kombinasi
//   3. Priority ranking — konsep mana yang paling berdampak

import type { StemmedConcept, StemmedWeather } from "./stemming"

// ─── Tipe output ─────────────────────────────────────────────────────────────

export interface DerivedInsight {
  id: string
  label: string
  severity: number
  source: string[]
  advice: string
}

export interface ReasoningResult {
  derivedInsights: DerivedInsight[]
  adjustedScore: number
  adjustedSentiment: StemmedWeather["overallSentiment"]
  priorityConcepts: StemmedConcept[]
}

// ─── Rule definition ─────────────────────────────────────────────────────────

interface CombinationRule {
  id: string
  label: string
  conditions: string[][]
  severity: number
  advice: string
}

const COMBINATION_RULES: CombinationRule[] = [
  // ── Panas + Lembap ───────────────────────────────────────────────────────
  {
    id: "gerah_ekstrem",
    label: "Gerah ekstrem — udara terasa berat dan lengket",
    conditions: [["panas", "sangat_lembap"]],
    severity: 0.4,
    advice: "Kombinasi panas dan lembap bikin tubuh sulit mendinginkan diri. Kurangi aktivitas berat dan perbanyak minum.",
  },
  {
    id: "heat_stress_berat",
    label: "Heat stress berat — risiko dehidrasi tinggi",
    conditions: [["sangat_panas", "sangat_lembap"]],
    severity: 0.6,
    advice: "Heat index berbahaya. Tubuh kesulitan mendinginkan diri. Hindari outdoor dan minum elektrolit.",
  },
  {
    id: "gerah_sedang",
    label: "Udara gerah dan tidak nyaman",
    conditions: [["panas", "lembap"]],
    severity: 0.25,
    advice: "Kombinasi panas dan lembap bikin tubuh cepat lelah. Minum lebih banyak dan cari tempat teduh.",
  },

  // ── Panas + UV ───────────────────────────────────────────────────────────
  {
    id: "heat_stroke_risiko",
    label: "Risiko heat stroke sangat tinggi",
    conditions: [["sangat_panas", "uv_ekstrem"]],
    severity: 0.55,
    advice: "Heat stroke mengancam. Jangan keluar antara jam 10–16, lindungi kepala dan minum banyak air.",
  },
  {
    id: "sunburn_risiko",
    label: "Risiko terbakar sinar matahari",
    conditions: [["panas", "uv_tinggi"], ["panas", "uv_sangat_tinggi"], ["sangat_panas", "uv_ekstrem"]],
    severity: 0.45,
    advice: "Kulit bisa terbakar dalam 20 menit tanpa perlindungan. Wajib SPF 50+, topi, dan kacamata hitam.",
  },
  {
    id: "uv_ekstrem_cerah",
    label: "UV ekstrem di langit cerah — kulit terbakar cepat",
    conditions: [["uv_ekstrem", "kondisi_sunny"], ["uv_ekstrem", "kondisi_clear"]],
    severity: 0.45,
    advice: "UV index ekstrem + langit cerah = kulit terbakar dalam hitungan menit. SPF 50+ dan stay indoors.",
  },

  // ── Angin + Badai ────────────────────────────────────────────────────────
  {
    id: "badai_petir_berbahaya",
    label: "Badai petir berbahaya — risiko petir dan angin kencang",
    conditions: [["angin_kencang", "kondisi_thunderstorm"]],
    severity: 0.65,
    advice: "Jangan berteduh di bawah pohon, hindari area terbuka. Amankan barang-barang di luar rumah.",
  },
  {
    id: "hujan_badai",
    label: "Hujan badai — angin kencang disertai hujan",
    conditions: [["angin_kencang", "hampir_pasti_hujan"], ["angin_kencang", "kemungkinan_hujan"]],
    severity: 0.35,
    advice: "Hujan deras dan angin kencang membuat jalanan sangat berbahaya. Tunda perjalanan jika tidak mendesak.",
  },
  {
    id: "badai_ekstrem",
    label: "Badai ekstrem — situasi sangat berbahaya",
    conditions: [["badai", "kondisi_thunderstorm"]],
    severity: 0.75,
    advice: "Badai ekstrem terdeteksi. Tetap di dalam ruangan, jauhi jendela, dan ikuti informasi resmi.",
  },
  {
    id: "angin_hujan_sedang",
    label: "Angin sedang disertai potensi hujan",
    conditions: [["angin_sedang", "kemungkinan_hujan"]],
    severity: 0.35,
    advice: "Angin lumayan kencang dan berpotensi hujan. Bawa jaket anti-air dan perhatikan barang ringan di sekitar.",
  },

  // ── Dingin + Beku ────────────────────────────────────────────────────────
  {
    id: "wind_chill_ekstrem",
    label: "Wind chill ekstrem — dingin terasa lebih menusuk",
    conditions: [["sangat_dingin", "angin_kencang"]],
    severity: 0.55,
    advice: "Angin kencang membuat suhu terasa jauh lebih dingin. Pakaian berlapis dan pelindung wajib.",
  },
  {
    id: "kondisi_beku",
    label: "Kondisi beku berbahaya — risiko hipotermia",
    conditions: [["sangat_dingin", "kondisi_snow"]],
    severity: 0.5,
    advice: "Suhu sangat dingin + salju = risiko hipotermia nyata. Batasi waktu di luar dan gunakan pakaian termal.",
  },
  {
    id: "dingin_kabut",
    label: "Dingin berkabut — jarak pandang rendah",
    conditions: [["dingin", "kondisi_fog"]],
    severity: 0.25,
    advice: "Udara dingin dan berkabut membuat jalanan licin dan jarak pandang terbatas. Hati-hati berkendara.",
  },

  // ── Visibilitas + Kondisi ────────────────────────────────────────────────
  {
    id: "berkendara_berbahaya",
    label: "Kondisi berkendara berbahaya",
    conditions: [["jarak_pandang_buruk", "kondisi_fog"], ["jarak_pandang_buruk", "kondisi_haze"]],
    severity: 0.45,
    advice: "Kabut tebal membatasi jarak pandang. Nyalakan lampu kabut, kurangi kecepatan, dan jaga jarak aman.",
  },
  {
    id: "banjir_risiko",
    label: "Risiko banjir lokal",
    conditions: [["jarak_pandang_buruk", "kondisi_heavy_rain"]],
    severity: 0.45,
    advice: "Hujan deras dengan kabut — kombinasi berbahaya untuk berkendara dan risiko banjir di titik rendah.",
  },
  {
    id: "kecelakaan_risiko",
    label: "Risiko kecelakaan tinggi",
    conditions: [["angin_kencang", "jarak_pandang_buruk"]],
    severity: 0.5,
    advice: "Angin kencang + jarak pandang rendah = risiko kecelakaan tinggi. Tunda perjalanan jika bisa.",
  },

  // ── Kering + UV ──────────────────────────────────────────────────────────
  {
    id: "kulit_rusak_cepat",
    label: "Kulit dan mata berisiko rusak",
    conditions: [["sangat_kering", "uv_tinggi"], ["sangat_kering", "uv_sangat_tinggi"]],
    severity: 0.3,
    advice: "Udara kering dan UV tinggi mempercepat kerusakan kulit. Pelembap dan tabir surya wajib dipakai.",
  },

  // ── Lembap + Hujan ───────────────────────────────────────────────────────
  {
    id: "banjir_bandang_risiko",
    label: "Risiko banjir bandang",
    conditions: [["sangat_lembap", "kondisi_heavy_rain"]],
    severity: 0.7,
    advice: "Udara sudah jenuh + hujan deras = banjir bandang di daerah rawan. Waspada dan siapkan evakuasi.",
  },
  {
    id: "banjir_lokal_waspada",
    label: "Waspada banjir lokal",
    conditions: [["sangat_lembap", "kondisi_rain"]],
    severity: 0.35,
    advice: "Kelembapan sudah tinggi + hujan = genangan air bisa meluap. Hati-hati di jalanan rendah.",
  },

  // ── Overcast + Hujan ─────────────────────────────────────────────────────
  {
    id: "hujan_pasti_turun",
    label: "Hujan sangat mungkin terjadi",
    conditions: [["kondisi_overcast", "kemungkinan_hujan"], ["kondisi_overcast", "hampir_pasti_hujan"]],
    severity: 0.2,
    advice: "Langit gelap dan peluang hujan tinggi. Payung wajib dibawa kemana pun.",
  },

  // ── Situasi nyaman ───────────────────────────────────────────────────────
  {
    id: "cuaca_ideal",
    label: "Kondisi cuaca ideal untuk aktivitas luar ruangan",
    conditions: [
      ["sejuk", "tenang"],
      ["sejuk", "sepoi_sepoi"],
      ["hangat", "tenang"],
      ["hangat", "sepoi_sepoi"],
    ],
    severity: -0.2,
    advice: "Suhu dan angin pas — waktu yang tepat untuk olahraga, jalan-jalan, atau piknik.",
  },
  {
    id: "cerah_nyaman",
    label: "Langit cerah dan nyaman",
    conditions: [
      ["kondisi_sunny", "sejuk"],
      ["kondisi_sunny", "hangat"],
      ["kondisi_mostly_sunny", "sejuk"],
      ["kondisi_mostly_sunny", "hangat"],
      ["kondisi_clear", "sejuk"],
      ["kondisi_clear", "hangat"],
    ],
    severity: -0.15,
    advice: "Matahari bersinar dengan suhu yang nyaman. Jangan lupa SPF tipis kalau beraktivitas lama.",
  },
]

// ─── Rule matcher ────────────────────────────────────────────────────────────

function matchRule(
  rule: CombinationRule,
  conceptNames: Set<string>
): boolean {
  return rule.conditions.some((condition) =>
    condition.every((c) => conceptNames.has(c))
  )
}

// ─── Sentiment adjustment ────────────────────────────────────────────────────

function escalateSentiment(
  original: StemmedWeather["overallSentiment"],
  maxSeverity: number
): StemmedWeather["overallSentiment"] {
  if (maxSeverity >= 0.5) return "berbahaya"
  if (maxSeverity >= 0.48 && (original === "baik" || original === "cukup")) return "waspada"
  return original
}

// ─── Priority sort key ───────────────────────────────────────────────────────

function priorityScore(concept: StemmedConcept, conceptInsights: Map<string, number>): number {
  const sentimentRank: Record<string, number> = { berbahaya: 4, waspada: 3, netral: 2, positif: 1 }
  const sentimentScore = sentimentRank[concept.sentiment] ?? 0
  const insightBoost = conceptInsights.get(concept.concept) ?? 0
  return sentimentScore * 25 + concept.weight * 25 + insightBoost * 30
}

// ─── MAIN REASONER ───────────────────────────────────────────────────────────

/**
 * Terima array StemmedConcept dari stemWeather(), kembalikan ReasoningResult
 * dengan derived insights dari kombinasi konsep, adjusted score & sentiment,
 * serta daftar konsep yang sudah diurutkan berdasarkan prioritas.
 */
export function reasonWeather(
  concepts: StemmedConcept[],
  stemmedOverall?: Pick<StemmedWeather, "overallSentiment" | "overallScore">
): ReasoningResult {
  const conceptNames = new Set(concepts.map((c) => c.concept))

  // ── Step 1: Detect combinations ──────────────────────────────────────────
  const insights: DerivedInsight[] = []

  const hasNegativeConcept = concepts.some(
    (c) => (c.sentiment === "waspada" || c.sentiment === "berbahaya") && !c.concept.startsWith("uv_")
  )
  const hasRainConcept = concepts.some(
    (c) => c.concept === "kondisi_drizzle" || c.concept === "kondisi_rain" || c.concept === "kondisi_heavy_rain"
  )

  for (const rule of COMBINATION_RULES) {
    if ((hasNegativeConcept || hasRainConcept) && rule.severity < 0) continue // skip positive rules if hazardous or rainy
    if (matchRule(rule, conceptNames)) {
      insights.push({
        id: rule.id,
        label: rule.label,
        severity: rule.severity,
        source: rule.conditions.find((cond) => cond.every((c) => conceptNames.has(c))) ?? [],
        advice: rule.advice,
      })
    }
  }

  // ── Step 2: Adjusted scoring ─────────────────────────────────────────────
  const maxSeverity = insights.length > 0
    ? Math.max(...insights.map((i) => i.severity))
    : 0

  const conceptInsights = new Map<string, number>()
  for (const insight of insights) {
    for (const source of insight.source) {
      conceptInsights.set(source, Math.max(conceptInsights.get(source) ?? 0, insight.severity))
    }
  }

  const adjustedWeights = concepts.map((c) => {
    const boost = conceptInsights.get(c.concept) ?? 0
    if (boost < 0) return c.weight // negative = good, no boost
    return Math.min(c.weight + boost * 1.5, 1.0)
  })

  const avgWeight = adjustedWeights.length > 0
    ? adjustedWeights.reduce((s, w) => s + w, 0) / adjustedWeights.length
    : 0
  const baseScore = Math.round(avgWeight * 100)
  const positiveInsightCount = insights.filter((i) => i.severity >= 0).length
  const adjustedScore = positiveInsightCount > 0
    ? Math.min(100, baseScore + Math.round(maxSeverity * 18))
    : Math.min(100, baseScore + 8)

  let rawSentiment = stemmedOverall?.overallSentiment ?? "cukup"
  // Upgrade "cukup" to "baik" if adjustedScore is high and no strong warnings present
  if (rawSentiment === "cukup" && adjustedScore >= 80) {
    const hasStrongWarning = concepts.some(
      (c) => c.sentiment === "berbahaya" || (c.sentiment === "waspada" && c.weight <= 0.35)
    )
    if (!hasStrongWarning) rawSentiment = "baik"
  }
  const adjustedSentiment = escalateSentiment(rawSentiment, maxSeverity)

  // ── Step 3: Priority ranking ─────────────────────────────────────────────
  const priorityConcepts = [...concepts].sort(
    (a, b) => priorityScore(b, conceptInsights) - priorityScore(a, conceptInsights)
  )

  return {
    derivedInsights: insights,
    adjustedScore,
    adjustedSentiment,
    priorityConcepts,
  }
}