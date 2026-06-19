// lib/nlp/xai/tokenizing-xai.ts
// XAI: Expose classification label mapping untuk setiap parameter cuaca
// Misal: 38°C → "sangat_panas", 85% → "sangat_lembap"

import type { WeatherToken } from "../tokenizing"
import type { TokenizingXai, TokenizingXaiClassification } from "./types"

const CLASSIFICATION_KEYS = new Set([
  "temp_label",
  "feels_like_label",
  "humidity_label",
  "wind_label",
  "uv_label",
  "visibility_label",
])

const CATEGORY_LABELS: Record<string, string> = {
  temperature: "Suhu Udara",
  humidity: "Kelembapan Udara",
  wind: "Angin",
  uv: "Indeks UV",
  visibility: "Visibilitas",
}

export function generateTokenizingXai(tokens: WeatherToken[]): TokenizingXai {
  const classifications: TokenizingXaiClassification[] = []

  for (const token of tokens) {
    if (!CLASSIFICATION_KEYS.has(token.key)) continue

    const paramLabel = CATEGORY_LABELS[token.category] ?? token.category
    const rawDisplay =
      typeof token.rawValue === "number"
        ? `${token.rawValue}${token.unit !== "label" ? token.unit : ""}`
        : token.rawValue

    classifications.push({
      parameter: paramLabel,
      rawValue: rawDisplay,
      unit: token.unit === "label" ? "" : token.unit,
      label: token.textToken,
      category: token.category,
    })
  }

  return { classifications }
}