// lib/nlp/xai/index.ts
// Orchestrator XAI — panggil semua generator XAI per layer

import type { WeatherToken } from "../tokenizing"
import type { StemmedConcept } from "../stemming"
import type { DerivedInsight } from "../reasoning"
import type { Ngram, TfIdfTerm } from "../features"
import type { SentimentResult } from "../sentiment"
import type { HighlightsResult } from "../highlights"

import type { XaiResult } from "./types"
import { generateTokenizingXai } from "./tokenizing-xai"
import { generateStemmingXai } from "./stemming-xai"
import { generateFeaturesXai } from "./features-xai"
import { generateReasoningXai } from "./reasoning-xai"
import { generateSentimentXai } from "./sentiment-xai"
import { generateHighlightXai } from "./highlight-xai"

export type { XaiResult } from "./types"
export type {
  TokenizingXai,
  StemmingXai,
  FeaturesXai,
  ReasoningXai,
  SentimentXai,
  HighlightXai,
} from "./types"

export function generateXai(params: {
  tokens: WeatherToken[]
  concepts: StemmedConcept[]
  derivedInsights: DerivedInsight[]
  bigrams: Ngram[]
  trigrams: Ngram[]
  tfIdfTerms: TfIdfTerm[]
  sentiment: SentimentResult
  highlights: HighlightsResult
}): XaiResult {
  return {
    tokenizing: generateTokenizingXai(params.tokens),
    stemming: generateStemmingXai(
      params.concepts,
      params.derivedInsights,
      params.sentiment.score,
    ),
    features: generateFeaturesXai(
      params.bigrams,
      params.trigrams,
      params.tfIdfTerms,
    ),
    reasoning: generateReasoningXai(params.derivedInsights),
    sentiment: generateSentimentXai(params.concepts, params.sentiment),
    highlights: generateHighlightXai(
      params.concepts,
      params.highlights,
      params.derivedInsights,
    ),
  }
}