// lib/nlp/xai/sentiment-xai.ts
// XAI: Detail breakdown sentimen — konsep mana yang masuk kategori apa
// dan penjelasan bagaimana skor akhir ditentukan

import type { StemmedConcept, StemmedWeather } from "../stemming"
import type { SentimentResult } from "../sentiment"
import type { SentimentXai, SentimentBreakdownDetail } from "./types"

const SENTIMENT_CATEGORIES: Array<{
  key: string
  field: "positif" | "netral" | "waspada" | "berbahaya"
  label: string
}> = [
  { key: "positif", field: "positif", label: "Positif" },
  { key: "netral", field: "netral", label: "Netral" },
  { key: "waspada", field: "waspada", label: "Waspada" },
  { key: "berbahaya", field: "berbahaya", label: "Berbahaya" },
]

function groupConceptsBySentiment(
  concepts: StemmedConcept[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const c of concepts) {
    const list = map.get(c.sentiment) ?? []
    list.push(c.humanLabel)
    map.set(c.sentiment, list)
  }
  return map
}

function buildScoreExplanation(
  concepts: StemmedConcept[],
  score: number,
): string {
  if (concepts.length === 0) return "Tidak ada data konsep untuk dihitung."

  const avgWeight =
    concepts.reduce((s, c) => s + c.weight, 0) / concepts.length
  const maxW = Math.max(...concepts.map((c) => c.weight))
  const minW = Math.min(...concepts.map((c) => c.weight))

  return `Skor ${score}/100 dihitung dari rata-rata bobot ${concepts.length} konsep (rata-rata: ${avgWeight.toFixed(2)}, tertinggi: ${maxW.toFixed(2)}, terendah: ${minW.toFixed(2)}). Semakin tinggi bobot, semakin baik kondisi cuaca.`
}

function buildLabelExplanation(
  label: StemmedWeather["overallSentiment"],
  concepts: StemmedConcept[],
  score: number,
): string {
  const berbahayaCount = concepts.filter((c) => c.sentiment === "berbahaya").length
  const waspadaCount = concepts.filter((c) => c.sentiment === "waspada").length
  const total = concepts.length || 1

  switch (label) {
    case "berbahaya":
      return `Label "Berbahaya" karena terdapat ${berbahayaCount} konsep berbahaya (syarat: ≥1 konsep berbahaya).`
    case "waspada": {
      const ratio = ((waspadaCount / total) * 100).toFixed(0)
      return `Label "Waspada" karena ${waspadaCount}/${total} konsep (${ratio}%) masuk kategori waspada (syarat: ≥50%) atau ada eskalasi dari reasoning engine.`
    }
    case "baik":
      return `Label "Baik" karena skor ${score} ≥ 75 dan tidak ada konsep berbahaya atau dominasi waspada.`
    case "cukup":
      return `Label "Cukup" karena skor ${score} < 75 dan tidak ada konsep berbahaya atau dominasi waspada.`
  }
}

export function generateSentimentXai(
  concepts: StemmedConcept[],
  sentiment: SentimentResult,
): SentimentXai {
  const grouped = groupConceptsBySentiment(concepts)
  const total = concepts.length || 1

  const breakdownDetail: SentimentBreakdownDetail[] = SENTIMENT_CATEGORIES.map(
    (cat) => {
      const conceptList = grouped.get(cat.key) ?? []
      return {
        category: cat.label,
        count: conceptList.length,
        percentage: Math.round((conceptList.length / total) * 100),
        concepts: conceptList,
      }
    },
  )

  return {
    breakdownDetail,
    scoreExplanation: buildScoreExplanation(concepts, sentiment.score),
    labelExplanation: buildLabelExplanation(sentiment.label, concepts, sentiment.score),
  }
}