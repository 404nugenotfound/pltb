// lib/nlp/analysis.ts
// Analysis Stage — menggabungkan Feature Extraction + Reasoning Engine
// Input : WeatherToken[] + StemmedWeather
// Output: AnalysisResult

import type { WeatherToken } from "./tokenizing"
import type { StemmedWeather, StemmedConcept } from "./stemming"
import { extractFeatures, type FeatureResult, type Ngram, type TfIdfTerm } from "./features"
import { reasonWeather, type ReasoningResult, type DerivedInsight } from "./reasoning"

export type { Ngram, TfIdfTerm, DerivedInsight }

export interface AnalysisResult {
  features: FeatureResult
  reasoning: ReasoningResult
  priorityConcepts: StemmedConcept[]
  adjustedScore: number
  adjustedSentiment: StemmedWeather["overallSentiment"]
}

/**
 * Jalankan feature extraction + reasoning engine terhadap data cuaca,
 * hasilkan AnalysisResult yang siap dikonsumsi oleh NLG.
 */
export function analyzeWeather(
  tokens: WeatherToken[],
  stemmed: StemmedWeather,
): AnalysisResult {
  const features = extractFeatures(tokens, stemmed.concepts)
  const reasoning = reasonWeather(stemmed.concepts)

  return {
    features,
    reasoning,
    priorityConcepts: reasoning.priorityConcepts,
    adjustedScore: reasoning.adjustedScore,
    adjustedSentiment: reasoning.adjustedSentiment,
  }
}