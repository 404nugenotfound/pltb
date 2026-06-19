// lib/nlp/pipeline.ts
// Pipeline Orchestrator — entry point tunggal untuk seluruh NLP pipeline
//
// Urutan stage:
//   1. tokenize (tokenizing.ts)
//   2. stem    (stemming.ts)
//   3. extract features (features.ts) — n-gram, TF-IDF
//   4. reason (reasoning.ts) — cross-concept reasoning engine
//   5. analyze (analysis.ts) — gabung features + reasoning
//   6. nlg (nlg.ts) — generate narasi
//   7. sentiment (sentiment.ts) — hitung breakdown
//   8. highlights (highlights.ts) — ekstrak peringatan
//
// route handler cukup panggil 1 fungsi: processWeatherNlp(raw)

import { tokenizeWeather, type WeatherRaw, type WeatherToken } from "./tokenizing"
import { stemWeather, getAdviceList, type StemmedWeather } from "./stemming"
import { extractFeatures, type Ngram, type TfIdfTerm } from "./features"
import { reasonWeather, type DerivedInsight } from "./reasoning"
import { analyzeWeather, type AnalysisResult } from "./analysis"
// import { generateNlg, type NlgResult, type NlgSentence } from "./nlg.ts"
import { generateNlg, type NlgResult, type NlgSentence } from "./nlg"
import { analyzeSentiment, type SentimentResult } from "./sentiment"
import { buildHighlights, type HighlightsResult } from "./highlights"
import { generateXai, type XaiResult } from "./xai"
import {
  validateTokenizing, validateStemming, validateFeatures,
  validateReasoning, validateNlg, validateSentiment, validateHighlights,
  type StageValidation,
} from "./validation"
import {
  accuracyTokenizing, accuracyStemming, accuracyFeatures,
  accuracyReasoning, accuracyNlg, accuracySentiment, accuracyHighlights,
  type StageAccuracy,
} from "./accuracy"

// ─── Tipe output pipeline ────────────────────────────────────────────────────

export interface PipelineStepLog {
  step1_raw: WeatherRaw
  step2_tokens: string[]
  step3_stemmed: {
    concepts: StemmedWeather["concepts"]
    overallSentiment: StemmedWeather["overallSentiment"]
    overallScore: number
  }
  step3a_features: {
    normalizedTokens: string[]
    removedStopwords: string[]
    topNgrams: Ngram[]
    topTerms: TfIdfTerm[]
  }
  step3b_reasoning: {
    derivedInsights: DerivedInsight[]
    adjustedScore: number
    adjustedSentiment: StemmedWeather["overallSentiment"]
  }
  step4_nlg: {
    narrative: string
    keyPhrase: string
  }
  step4_nlp: {
    summary: string
    sentiment: SentimentResult
    advice: string[]
    highlights: HighlightsResult
  }
  step5_xai: XaiResult
  validation: {
    tokenizing: StageValidation
    stemming: StageValidation
    features: StageValidation
    reasoning: StageValidation
    nlg: StageValidation
    sentiment: StageValidation
    highlights: StageValidation
  }
  accuracy: {
    tokenizing: StageAccuracy
    stemming: StageAccuracy
    features: StageAccuracy
    reasoning: StageAccuracy
    nlg: StageAccuracy
    sentiment: StageAccuracy
    highlights: StageAccuracy
  }
}

export interface PipelineResult {
  summary: string
  keyPhrase: string
  sentiment: SentimentResult
  advice: string[]
  highlights: HighlightsResult
  xai: XaiResult
  validation: {
    tokenizing: StageValidation
    stemming: StageValidation
    features: StageValidation
    reasoning: StageValidation
    nlg: StageValidation
    sentiment: StageValidation
    highlights: StageValidation
  }
  accuracy: {
    tokenizing: StageAccuracy
    stemming: StageAccuracy
    features: StageAccuracy
    reasoning: StageAccuracy
    nlg: StageAccuracy
    sentiment: StageAccuracy
    highlights: StageAccuracy
  }
  nlpArtifacts: {
    sentences: NlgSentence[]
    bigrams: Ngram[]
    trigrams: Ngram[]
    tfIdfTerms: TfIdfTerm[]
    derivedInsights: DerivedInsight[]
  }
  pipeline: PipelineStepLog
}

// ─── MAIN PIPELINE ───────────────────────────────────────────────────────────

/**
 * Proses data cuaca mentah melalui seluruh pipeline NLP:
 *   tokenize → stem → features → reason → analyze → nlg → sentiment + highlights
 *
 * @param raw   - Data cuaca mentah dari xWeather API
 * @param dateISO - Opsional, ISO date untuk membedakan seed NLG antar hari
 */
export function processWeatherNlp(raw: WeatherRaw, dateISO?: string): PipelineResult {
  // ── Stage 1: Tokenizing ─────────────────────────────────────────────────
  const tokens = tokenizeWeather(raw)
  const textTokens = tokens.map(t => t.textToken)

  // ── Stage 2: Stemming ───────────────────────────────────────────────────
  const stemmed = stemWeather(tokens)

  // ── Stage 3a: Feature Extraction (n-gram, TF-IDF) ──────────────────────
  const features = extractFeatures(tokens, stemmed.concepts)

  // ── Stage 3b: Reasoning Engine ──────────────────────────────────────────
  const reasoning = reasonWeather(stemmed.concepts, { overallSentiment: stemmed.overallSentiment, overallScore: stemmed.overallScore })

  // ── Stage 4: Analysis (gabung features + reasoning) ─────────────────────
  const analysis: AnalysisResult = {
    features,
    reasoning,
    priorityConcepts: reasoning.priorityConcepts,
    adjustedScore: reasoning.adjustedScore,
    adjustedSentiment: reasoning.adjustedSentiment,
  }

  // ── Stage 5: NLG ────────────────────────────────────────────────────────
  const nlg = generateNlg(analysis, stemmed, tokens, dateISO)

  // ── Stage 6: Sentiment ──────────────────────────────────────────────────
  const sentiment = analyzeSentiment(stemmed)

  // ── Stage 7: Highlights ─────────────────────────────────────────────────
  const highlights = buildHighlights(stemmed)
  const advice = getAdviceList(stemmed)

  // ── Stage 8: XAI ────────────────────────────────────────────────────────
  const xai = generateXai({
    tokens,
    concepts: stemmed.concepts,
    derivedInsights: reasoning.derivedInsights,
    bigrams: features.bigrams,
    trigrams: features.trigrams,
    tfIdfTerms: features.tfIdfTerms,
    sentiment,
    highlights,
  })

  // ── Validation per stage ───────────────────────────────────────────────
  const valTokenizing = validateTokenizing(tokens)
  const valStemming = validateStemming(stemmed.concepts, stemmed.overallSentiment, stemmed.overallScore)
  const valFeatures = validateFeatures(features)
  const valReasoning = validateReasoning(reasoning)
  const valNlg = validateNlg(nlg)
  const valSentiment = validateSentiment(sentiment)
  const valHighlights = validateHighlights(highlights)

  // ── Accuracy per stage ─────────────────────────────────────────────────
  const accTokenizing = accuracyTokenizing(tokens, raw)
  const accStemming = accuracyStemming(stemmed.concepts)
  const accFeatures = accuracyFeatures(features)
  const accReasoning = accuracyReasoning(reasoning, stemmed.concepts.map((c) => c.concept))
  const accNlg = accuracyNlg(nlg)
  const accSentiment = accuracySentiment(sentiment, stemmed.concepts)
  const accHighlights = accuracyHighlights(highlights, stemmed.concepts)

  // ── Assemble result ─────────────────────────────────────────────────────
  return {
    summary: nlg.narrative,
    keyPhrase: nlg.keyPhrase,
    sentiment,
    advice,
    highlights,
    xai,
    validation: {
      tokenizing: valTokenizing,
      stemming: valStemming,
      features: valFeatures,
      reasoning: valReasoning,
      nlg: valNlg,
      sentiment: valSentiment,
      highlights: valHighlights,
    },
    accuracy: {
      tokenizing: accTokenizing,
      stemming: accStemming,
      features: accFeatures,
      reasoning: accReasoning,
      nlg: accNlg,
      sentiment: accSentiment,
      highlights: accHighlights,
    },
    nlpArtifacts: {
      sentences: nlg.sentences,
      bigrams: features.bigrams,
      trigrams: features.trigrams,
      tfIdfTerms: features.tfIdfTerms,
      derivedInsights: reasoning.derivedInsights,
    },
    pipeline: {
      step1_raw: raw,
      step2_tokens: textTokens,
      step3_stemmed: {
        concepts: stemmed.concepts,
        overallSentiment: stemmed.overallSentiment,
        overallScore: stemmed.overallScore,
      },
      step3a_features: {
        normalizedTokens: features.normalizedTokens,
        removedStopwords: features.removedStopwords,
        topNgrams: features.topNgrams,
        topTerms: features.topTerms,
      },
      step3b_reasoning: {
        derivedInsights: reasoning.derivedInsights,
        adjustedScore: reasoning.adjustedScore,
        adjustedSentiment: reasoning.adjustedSentiment,
      },
      step4_nlg: {
        narrative: nlg.narrative,
        keyPhrase: nlg.keyPhrase,
      },
      step4_nlp: {
        summary: nlg.narrative,
        sentiment,
        advice,
        highlights,
      },
      step5_xai: xai,
      validation: {
        tokenizing: valTokenizing,
        stemming: valStemming,
        features: valFeatures,
        reasoning: valReasoning,
        nlg: valNlg,
        sentiment: valSentiment,
        highlights: valHighlights,
      },
      accuracy: {
        tokenizing: accTokenizing,
        stemming: accStemming,
        features: accFeatures,
        reasoning: accReasoning,
        nlg: accNlg,
        sentiment: accSentiment,
        highlights: accHighlights,
      },
    },
  }
}