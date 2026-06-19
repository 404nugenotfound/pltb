// lib/nlp/xai/types.ts
// Tipe data untuk Explainable AI (XAI) output per layer pipeline NLP

export interface TokenizingXaiClassification {
  parameter: string
  rawValue: number | string
  unit: string
  label: string
  category: string
}

export interface TokenizingXai {
  classifications: TokenizingXaiClassification[]
}

export interface StemmingXaiItem {
  concept: string
  humanLabel: string
  sentiment: string
  baseWeight: number
  finalWeight: number
  boostAmount: number
  boostSources: string[]
}

export interface StemmingXai {
  concepts: StemmingXaiItem[]
}

export interface NgramXaiItem {
  ngram: string
  baseScore: number
  boost: number
  finalScore: number
  boostReason: string
}

export interface TfidfXaiItem {
  term: string
  tfidf: number
  significance: "tinggi" | "sedang" | "rendah"
}

export interface FeaturesXai {
  ngramBoosts: NgramXaiItem[]
  tfidfHighlights: TfidfXaiItem[]
}

export interface ReasoningXaiItem {
  ruleId: string
  label: string
  matchedConditions: string[]
  severity: number
  impactDescription: string
  advice: string
}

export interface ReasoningXai {
  activeRules: ReasoningXaiItem[]
  totalRules: number
}

export interface SentimentBreakdownDetail {
  category: string
  count: number
  percentage: number
  concepts: string[]
}

export interface SentimentXai {
  breakdownDetail: SentimentBreakdownDetail[]
  scoreExplanation: string
  labelExplanation: string
}

export interface HighlightXaiItem {
  text: string
  reason: string
  sourceConcept: string
}

export interface HighlightXai {
  warnings: HighlightXaiItem[]
  positives: HighlightXaiItem[]
}

export interface XaiResult {
  tokenizing: TokenizingXai
  stemming: StemmingXai
  features: FeaturesXai
  reasoning: ReasoningXai
  sentiment: SentimentXai
  highlights: HighlightXai
}