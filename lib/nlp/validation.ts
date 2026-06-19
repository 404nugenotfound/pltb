// lib/nlp/validation.ts
// Validasi struktural — memeriksa setiap stage output memiliki format yang benar

import type { WeatherToken } from "./tokenizing"
import type { StemmedConcept, StemmedWeather } from "./stemming"
import type { FeatureResult } from "./features"
import type { ReasoningResult } from "./reasoning"
import type { NlgResult, NlgSentence } from "./nlg.ts"
import type { SentimentResult } from "./sentiment"
import type { HighlightsResult } from "./highlights"

// ─── Tipe output ─────────────────────────────────────────────────────────────

export interface ValCheck {
  name: string
  status: "passed" | "warning" | "failed"
  message: string
}

export interface StageValidation {
  stage: string
  status: "passed" | "warning" | "failed"
  checks: ValCheck[]
}

const VALID_CATEGORIES = new Set([
  "temperature", "humidity", "wind", "weather", "uv", "visibility", "precipitation", "location",
] as WeatherToken["category"][])

const VALID_SENTIMENTS = new Set<StemmedConcept["sentiment"]>([
  "positif", "netral", "waspada", "berbahaya",
])

const VALID_OVERALL = new Set<StemmedWeather["overallSentiment"]>([
  "baik", "cukup", "waspada", "berbahaya",
])

const VALID_NLG_TYPES = new Set<NlgSentence["type"]>([
  "opening", "condition", "wind", "rain", "uv", "advice", "closing",
])

function check(
  name: string,
  passed: boolean,
  message: string,
  warnOnFail = false,
): ValCheck {
  return {
    name,
    status: passed ? "passed" : warnOnFail ? "warning" : "failed",
    message: passed ? `✓ ${message}` : `✗ ${message}`,
  }
}

function aggregateStatus(checks: ValCheck[]): "passed" | "warning" | "failed" {
  if (checks.some((c) => c.status === "failed")) return "failed"
  if (checks.some((c) => c.status === "warning")) return "warning"
  return "passed"
}

// ─── Stage 1: Tokenizing ─────────────────────────────────────────────────────

export function validateTokenizing(tokens: WeatherToken[]): StageValidation {
  const checks: ValCheck[] = []

  checks.push(
    check(
      "required_fields",
      tokens.every((t) => t.key !== undefined && t.rawValue !== undefined
        && t.unit !== undefined && t.textToken !== undefined && t.category !== undefined),
      "Semua token memiliki field yang diperlukan (key, rawValue, unit, textToken, category)",
    ),
  )

  checks.push(
    check(
      "category_enum",
      tokens.every((t) => VALID_CATEGORIES.has(t.category)),
      "Semua token memiliki category yang valid",
    ),
  )

  const labelTokens = tokens.filter((t) => t.key.endsWith("_label"))
  checks.push(
    check(
      "unit_label",
      labelTokens.every((t) => t.unit === "label"),
      `Semua ${labelTokens.length} token label memiliki unit "label"`,
    ),
  )

  const numericKeys = new Set(["temp_c", "feels_like_c", "humidity_pct", "wind_speed_kph",
    "wind_gust_kph", "uvi", "visibility_km", "pop_pct", "precip_mm", "sky_cover_pct"])
  const numericTokens = tokens.filter((t) => numericKeys.has(t.key))
  checks.push(
    check(
      "rawValue_type_numeric",
      numericTokens.every((t) => typeof t.rawValue === "number" && !Number.isNaN(t.rawValue)),
      `Semua ${numericTokens.length} token numerik memiliki rawValue berupa angka valid`,
    ),
  )

  return {
    stage: "tokenizing",
    status: aggregateStatus(checks),
    checks,
  }
}

// ─── Stage 2: Stemming ───────────────────────────────────────────────────────

export function validateStemming(
  concepts: StemmedConcept[],
  overallSentiment: StemmedWeather["overallSentiment"],
  overallScore: number,
): StageValidation {
  const checks: ValCheck[] = []

  checks.push(
    check(
      "concept_fields",
      concepts.every((c) => c.concept !== undefined && c.sentiment !== undefined
        && c.weight !== undefined && c.humanLabel !== undefined && c.advice !== undefined),
      `Semua ${concepts.length} konsep memiliki field yang diperlukan`,
    ),
  )

  checks.push(
    check(
      "sentiment_enum",
      concepts.every((c) => VALID_SENTIMENTS.has(c.sentiment)),
      "Semua sentiment konsep valid",
    ),
  )

  checks.push(
    check(
      "weight_range",
      concepts.every((c) => c.weight >= 0 && c.weight <= 1),
      `Semua ${concepts.length} weight dalam rentang 0–1`,
    ),
  )

  checks.push(
    check(
      "overall_label",
      VALID_OVERALL.has(overallSentiment),
      `Label keseluruhan "${overallSentiment}" valid`,
    ),
  )

  checks.push(
    check(
      "overall_score_range",
      overallScore >= 0 && overallScore <= 100,
      `Skor keseluruhan ${overallScore} dalam rentang 0–100`,
    ),
  )

  return {
    stage: "stemming",
    status: aggregateStatus(checks),
    checks,
  }
}

// ─── Stage 3a: Features ──────────────────────────────────────────────────────

export function validateFeatures(features: FeatureResult): StageValidation {
  const checks: ValCheck[] = []

  checks.push(
    check(
      "normalized_tokens",
      Array.isArray(features.normalizedTokens),
      "normalizedTokens adalah array",
    ),
  )

  const allNgrams = [...features.bigrams, ...features.trigrams]
  checks.push(
    check(
      "ngram_fields",
      allNgrams.every((ng) => Array.isArray(ng.tokens) && (ng.gram === 2 || ng.gram === 3)
        && typeof ng.score === "number" && typeof ng.label === "string"),
      `Semua ${allNgrams.length} n-gram memiliki field valid`,
    ),
  )

  checks.push(
    check(
      "tfidf_fields",
      features.tfIdfTerms.every((t) => typeof t.term === "string"
        && typeof t.tf === "number" && typeof t.idf === "number" && typeof t.tfidf === "number"),
      `Semua ${features.tfIdfTerms.length} TF-IDF term memiliki field valid`,
    ),
  )

  checks.push(
    check(
      "no_stopwords_in_normalized",
      features.normalizedTokens.every((t) => {
        const base = t.replace(/_\d[\d.]*[a-z%]*/g, "").replace(/_+$/, "")
        return !["lokasi", "kondisi", "cuaca", "tidak", "ada"].includes(base)
      }),
      "Tidak ada stopword lolos ke normalizedTokens",
    ),
  )

  const allScores = allNgrams.map((ng) => ng.score).filter((s) => typeof s === "number")
  checks.push(
    check(
      "score_finite",
      allScores.every((s) => Number.isFinite(s)),
      "Semua score n-gram finite (bukan NaN/Infinity)",
    ),
  )

  return {
    stage: "features",
    status: aggregateStatus(checks),
    checks,
  }
}

// ─── Stage 3b: Reasoning ─────────────────────────────────────────────────────

export function validateReasoning(reasoning: ReasoningResult): StageValidation {
  const checks: ValCheck[] = []

  checks.push(
    check(
      "insight_fields",
      reasoning.derivedInsights.every((i) => i.id !== undefined && i.label !== undefined
        && i.severity !== undefined && Array.isArray(i.source) && i.advice !== undefined),
      `Semua ${reasoning.derivedInsights.length} insight memiliki field valid`,
    ),
  )

  checks.push(
    check(
      "severity_range",
      reasoning.derivedInsights.every((i) => i.severity >= -1 && i.severity <= 1),
      "Semua severity dalam rentang -1 hingga 1",
    ),
  )

  checks.push(
    check(
      "adjusted_score_range",
      reasoning.adjustedScore >= 0 && reasoning.adjustedScore <= 100,
      `Adjusted score ${reasoning.adjustedScore} dalam rentang 0–100`,
    ),
  )

  checks.push(
    check(
      "adjusted_sentiment_valid",
      VALID_OVERALL.has(reasoning.adjustedSentiment),
      `Adjusted sentiment "${reasoning.adjustedSentiment}" valid`,
    ),
  )

  checks.push(
    check(
      "priority_concepts",
      Array.isArray(reasoning.priorityConcepts),
      "priorityConcepts adalah array",
    ),
  )

  return {
    stage: "reasoning",
    status: aggregateStatus(checks),
    checks,
  }
}

// ─── Stage 4: NLG ────────────────────────────────────────────────────────────

export function validateNlg(nlg: NlgResult): StageValidation {
  const checks: ValCheck[] = []

  checks.push(
    check(
      "narrative_exists",
      typeof nlg.narrative === "string" && nlg.narrative.length > 0,
      `Narrative ada (${nlg.narrative.length} karakter)`,
    ),
  )

  checks.push(
    check(
      "keyphrase_exists",
      typeof nlg.keyPhrase === "string" && nlg.keyPhrase.length > 0,
      `Key phrase ada: "${nlg.keyPhrase}"`,
    ),
  )

  checks.push(
    check(
      "sentences_array",
      Array.isArray(nlg.sentences) && nlg.sentences.length > 0,
      `${nlg.sentences.length} kalimat dihasilkan`,
    ),
  )

  checks.push(
    check(
      "sentence_structure",
      nlg.sentences.every((s) => typeof s.text === "string" && typeof s.weight === "number"
        && VALID_NLG_TYPES.has(s.type)),
      "Semua sentence memiliki type, text, weight valid",
    ),
  )

  return {
    stage: "nlg",
    status: aggregateStatus(checks),
    checks,
  }
}

// ─── Stage 5: Sentiment ──────────────────────────────────────────────────────

export function validateSentiment(sentiment: SentimentResult): StageValidation {
  const checks: ValCheck[] = []

  checks.push(
    check(
      "label_enum",
      VALID_OVERALL.has(sentiment.label),
      `Label "${sentiment.label}" valid`,
    ),
  )

  checks.push(
    check(
      "score_range",
      sentiment.score >= 0 && sentiment.score <= 100,
      `Score ${sentiment.score} dalam rentang 0–100`,
    ),
  )

  const bd = sentiment.breakdown
  const total = bd.positif + bd.netral + bd.waspada + bd.berbahaya
  checks.push(
    check(
      "breakdown_sum",
      total >= 98 && total <= 102,
      `Breakdown total ${total}% (toleransi ±2%)`,
      true,
    ),
  )

  checks.push(
    check(
      "tone_exists",
      typeof sentiment.tone === "string" && sentiment.tone.length > 0,
      "Tone ada dan tidak kosong",
    ),
  )

  checks.push(
    check(
      "breakdown_non_negative",
      bd.positif >= 0 && bd.netral >= 0 && bd.waspada >= 0 && bd.berbahaya >= 0,
      "Semua nilai breakdown non-negatif",
    ),
  )

  return {
    stage: "sentiment",
    status: aggregateStatus(checks),
    checks,
  }
}

// ─── Stage 6: Highlights ─────────────────────────────────────────────────────

export function validateHighlights(highlights: HighlightsResult): StageValidation {
  const checks: ValCheck[] = []

  checks.push(
    check(
      "warnings_array",
      Array.isArray(highlights.warnings),
      "Warnings adalah array",
    ),
  )

  checks.push(
    check(
      "positives_array",
      Array.isArray(highlights.positives),
      "Positives adalah array",
    ),
  )

  checks.push(
    check(
      "warnings_strings",
      highlights.warnings.every((w) => typeof w === "string"),
      `Semua ${highlights.warnings.length} warning adalah string`,
    ),
  )

  checks.push(
    check(
      "positives_strings",
      highlights.positives.every((p) => typeof p === "string"),
      `Semua ${highlights.positives.length} positive adalah string`,
    ),
  )

  return {
    stage: "highlights",
    status: aggregateStatus(checks),
    checks,
  }
}