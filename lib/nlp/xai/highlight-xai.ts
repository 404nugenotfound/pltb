// lib/nlp/xai/highlight-xai.ts
// XAI: Tambah alasan untuk setiap warning dan positive highlight
// Menjelaskan kenapa suatu kondisi masuk daftar perhatian

import type { StemmedConcept } from "../stemming"
import type { DerivedInsight } from "../reasoning"
import type { HighlightsResult } from "../highlights"
import type { HighlightXai, HighlightXaiItem } from "./types"

function findReason(
  concept: StemmedConcept,
  insights: DerivedInsight[],
): string {
  // Cari rule yang menyebut konsep ini sebagai source
  const relatedInsights = insights.filter((i) =>
    i.source.includes(concept.concept),
  )

  if (relatedInsights.length > 0) {
    const top = relatedInsights.sort((a, b) => b.severity - a.severity)[0]
    return `Diperkuat oleh rule "${top.label}" (+${top.severity.toFixed(2)}) karena kombinasi dengan ${top.source.filter((s) => s !== concept.concept).join(", ") || "faktor lain"}.`
  }

  // Fallback: jelaskan berdasarkan weight
  if (concept.weight <= 0.3) {
    return `Bobot sangat rendah (${concept.weight.toFixed(2)}) — indikasi kondisi ekstrem.`
  }
  if (concept.sentiment === "waspada") {
    return `Kategori waspada dengan bobot ${concept.weight.toFixed(2)} — perlu perhatian.`
  }
  if (concept.sentiment === "berbahaya") {
    return `Kategori berbahaya dengan bobot ${concept.weight.toFixed(2)} — risiko tinggi.`
  }
  return `Berdasarkan klasifikasi konsep "${concept.concept}".`
}

function findPositiveReason(concept: StemmedConcept): string {
  if (concept.weight >= 0.9) {
    return `Bobot sangat tinggi (${concept.weight.toFixed(2)}) — kondisi optimal.`
  }
  return `Kategori positif dengan bobot ${concept.weight.toFixed(2)} — mendukung aktivitas.`
}

export function generateHighlightXai(
  concepts: StemmedConcept[],
  highlights: HighlightsResult,
  insights: DerivedInsight[],
): HighlightXai {
  const conceptMap = new Map<string, StemmedConcept>()
  for (const c of concepts) {
    conceptMap.set(c.humanLabel, c)
  }

  const warnings: HighlightXaiItem[] = highlights.warnings.map((w) => {
    const concept = conceptMap.get(w)
    return {
      text: w,
      reason: concept
        ? findReason(concept, insights)
        : "Konsep tidak ditemukan dalam hasil stemming.",
      sourceConcept: concept?.concept ?? "unknown",
    }
  })

  const positives: HighlightXaiItem[] = highlights.positives.map((p) => {
    const concept = conceptMap.get(p)
    return {
      text: p,
      reason: concept
        ? findPositiveReason(concept)
        : "Konsep tidak ditemukan dalam hasil stemming.",
      sourceConcept: concept?.concept ?? "unknown",
    }
  })

  return { warnings, positives }
}