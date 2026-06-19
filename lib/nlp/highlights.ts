// lib/nlp/highlights.ts
// Highlights Builder — ekstrak peringatan & sentimen positif dari StemmedWeather

import { getConceptsBySentiment, type StemmedWeather } from "./stemming"

export interface HighlightsResult {
  warnings: string[]
  positives: string[]
}

export function buildHighlights(stemmed: StemmedWeather): HighlightsResult {
  return {
    warnings: [...getConceptsBySentiment(stemmed, "waspada"), ...getConceptsBySentiment(stemmed, "berbahaya")]
      .map(c => c.humanLabel),
    positives: getConceptsBySentiment(stemmed, "positif").map(c => c.humanLabel),
  }
}