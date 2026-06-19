// lib/nlp/features.ts
// Feature Extraction — Stage terpisah untuk n-gram & TF-IDF
// Input : WeatherToken[] + StemmedConcept[]
// Output: FeatureResult (ngrams, tfidf, normalized tokens)

import type { WeatherToken } from "./tokenizing"
import type { StemmedConcept } from "./stemming"

// ─── Tipe output ─────────────────────────────────────────────────────────────

export interface Ngram {
  tokens: string[]
  gram: 2 | 3
  score: number
  label: string
}

export interface TfIdfTerm {
  term: string
  tf: number
  idf: number
  tfidf: number
}

export interface FeatureResult {
  normalizedTokens: string[]
  removedStopwords: string[]
  bigrams: Ngram[]
  trigrams: Ngram[]
  topNgrams: Ngram[]
  tfIdfTerms: TfIdfTerm[]
  topTerms: TfIdfTerm[]
}

// ─── Stopwords ───────────────────────────────────────────────────────────────

const WEATHER_STOPWORDS = new Set([
  "lokasi", "kondisi", "cuaca", "tidak", "ada",
  "dari", "dan", "atau", "yang", "di", "ke",
  "suhu", "angin", "udara",
  "nol", "pct",
])

const NUMERIC_RE = /^(suhu_|feels_like_|humidity_|wind_\d|wind_gust_|sky_|uvi_\d|visibilitas_|peluang_hujan_\d|curah_hujan_\d|lokasi_)/

// ─── Normalization ───────────────────────────────────────────────────────────

function normalizeTokens(rawTokens: string[]): {
  normalized: string[]
  removedStopwords: string[]
} {
  const seen = new Set<string>()
  const normalized: string[] = []
  const removedStopwords: string[] = []

  for (const tok of rawTokens) {
    if (seen.has(tok)) continue
    seen.add(tok)

    const baseTerm = tok.replace(/_\d[\d.]*[a-z%]*/g, "").replace(/_+$/, "")

    if (WEATHER_STOPWORDS.has(baseTerm) || WEATHER_STOPWORDS.has(tok)) {
      removedStopwords.push(tok)
      continue
    }

    normalized.push(tok)
  }

  return { normalized, removedStopwords }
}

// ─── N-gram ──────────────────────────────────────────────────────────────────

const NGRAM_DOMAIN_BOOST: Record<string, number> = {
  "panas|sangat_lembap": 1.8,
  "sangat_panas|sangat_lembap": 2.2,
  "angin_kencang|kondisi_thunderstorm": 2.0,
  "badai|kondisi_thunderstorm": 2.5,
  "uv_tinggi|kondisi_sunny": 1.5,
  "uv_sangat_tinggi|kondisi_sunny": 1.8,
  "uv_ekstrem|kondisi_sunny": 2.0,
  "jarak_pandang_buruk|kondisi_fog": 1.9,
  "kondisi_heavy_rain|angin_kencang": 2.1,
  "hampir_pasti_hujan|angin_kencang": 1.9,
}

function buildNgramKey(a: string, b: string): string {
  return `${a}|${b}`
}

function buildNgrams(tokens: string[], n: 2 | 3): Ngram[] {
  const ngrams: Ngram[] = []

  for (let i = 0; i <= tokens.length - n; i++) {
    const slice = tokens.slice(i, i + n)
    const hasLabel = slice.some(t => !NUMERIC_RE.test(t))
    if (!hasLabel) continue

    const baseScore = slice.reduce((s, t) => s + t.length, 0) / (n * 10)

    let domainBoost = 1.0
    if (n === 2) {
      const key1 = buildNgramKey(slice[0], slice[1])
      const key2 = buildNgramKey(slice[1], slice[0])
      domainBoost = NGRAM_DOMAIN_BOOST[key1] ?? NGRAM_DOMAIN_BOOST[key2] ?? 1.0
    } else if (n === 3) {
      const pairs = [
        buildNgramKey(slice[0], slice[1]),
        buildNgramKey(slice[1], slice[2]),
        buildNgramKey(slice[0], slice[2]),
      ]
      domainBoost = Math.max(...pairs.map(k => NGRAM_DOMAIN_BOOST[k] ?? 1.0))
    }

    const score = parseFloat((baseScore * domainBoost).toFixed(4))
    const label = slice.join(" + ")
    ngrams.push({ tokens: slice, gram: n, score, label })
  }

  const seen = new Set<string>()
  return ngrams.filter(ng => {
    if (seen.has(ng.label)) return false
    seen.add(ng.label)
    return true
  })
}

// ─── TF-IDF ──────────────────────────────────────────────────────────────────

const CORPUS_IDF: Record<string, number> = {
  hangat: 0.4,
  sejuk: 0.4,
  normal: 0.3,
  tenang: 0.4,
  sepoi_sepoi: 0.5,
  tidak_hujan: 0.4,
  curah_hujan_nol: 0.3,
  jarak_pandang_baik: 0.4,
  uv_rendah: 0.5,
  uv_sedang: 0.6,
  lembap: 0.7,
  kering: 0.7,
  angin_ringan: 0.7,
  angin_sedang: 0.8,
  panas: 0.8,
  dingin: 0.8,
  jarak_pandang_sedang: 0.8,
  peluang_hujan_kecil: 0.7,
  peluang_hujan_sedang: 0.8,
  sangat_panas: 1.4,
  sangat_dingin: 1.4,
  sangat_lembap: 1.2,
  sangat_kering: 1.2,
  angin_kencang: 1.3,
  badai: 1.8,
  uv_tinggi: 1.2,
  uv_sangat_tinggi: 1.5,
  uv_ekstrem: 1.9,
  jarak_pandang_buruk: 1.4,
  kemungkinan_hujan: 1.1,
  hampir_pasti_hujan: 1.4,
  "kondisi_thunderstorm": 1.8,
  "kondisi_heavy_rain": 1.5,
  "kondisi_snow": 1.6,
  "kondisi_fog": 1.2,
}

const DEFAULT_IDF = 1.0

function computeTfIdf(
  normalizedTokens: string[],
  concepts: StemmedConcept[]
): TfIdfTerm[] {
  const termFreq = new Map<string, number>()

  for (const tok of normalizedTokens) {
    termFreq.set(tok, (termFreq.get(tok) ?? 0) + 1)
  }
  for (const c of concepts) {
    termFreq.set(c.concept, (termFreq.get(c.concept) ?? 0) + 1)
  }

  const totalTerms = normalizedTokens.length || 1
  const results: TfIdfTerm[] = []

  termFreq.forEach((freq, term) => {
    const tf = freq / totalTerms
    const idf = CORPUS_IDF[term] ?? DEFAULT_IDF
    const tfidf = parseFloat((tf * idf).toFixed(6))
    results.push({ term, tf: parseFloat(tf.toFixed(4)), idf, tfidf })
  })

  return results.sort((a, b) => b.tfidf - a.tfidf)
}

// ─── MAIN FEATURE EXTRACTOR ──────────────────────────────────────────────────

/**
 * Ekstrak fitur NLP dari WeatherToken[] dan StemmedConcept[]:
 * normalisasi, n-gram (bigram & trigram), TF-IDF weighting.
 */
export function extractFeatures(
  tokens: WeatherToken[],
  concepts: StemmedConcept[],
): FeatureResult {
  const rawTextTokens = tokens.map(t => t.textToken)
  const { normalized, removedStopwords } = normalizeTokens(rawTextTokens)

  const labelTokens = normalized.filter(t => !NUMERIC_RE.test(t))
  const bigrams = buildNgrams(labelTokens, 2)
  const trigrams = buildNgrams(labelTokens, 3)
  const allNgrams = [...bigrams, ...trigrams].sort((a, b) => b.score - a.score)
  const topNgrams = allNgrams.slice(0, 5)

  const tfIdfTerms = computeTfIdf(normalized, concepts)
  const topTerms = tfIdfTerms.slice(0, 5)

  return {
    normalizedTokens: normalized,
    removedStopwords,
    bigrams,
    trigrams,
    topNgrams,
    tfIdfTerms,
    topTerms,
  }
}