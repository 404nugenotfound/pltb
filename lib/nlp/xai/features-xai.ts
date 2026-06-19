// lib/nlp/xai/features-xai.ts
// XAI: Ekspos N-gram domain boost & TF-IDF significance
// Menunjukkan faktor penguat dalam analisis cuaca

import type { Ngram, TfIdfTerm } from "../features"
import type { FeaturesXai, NgramXaiItem, TfidfXaiItem } from "./types"

const NGRAM_DOMAIN_BOOST_REASONS: Record<string, string> = {
  "panas|sangat_lembap": "Kombinasi panas + lembap ekstrem (gerah ekstrem)",
  "sangat_panas|sangat_lembap": "Kombinasi sangat panas + lembap (heat stress berat)",
  "angin_kencang|kondisi_thunderstorm": "Angin kencang + badai petir (badai berbahaya)",
  "badai|kondisi_thunderstorm": "Badai + petir (badai ekstrem)",
  "uv_tinggi|kondisi_sunny": "UV tinggi + langit cerah",
  "uv_sangat_tinggi|kondisi_sunny": "UV sangat tinggi + langit cerah",
  "uv_ekstrem|kondisi_sunny": "UV ekstrem + langit cerah (risiko terbakar)",
  "jarak_pandang_buruk|kondisi_fog": "Kabut + pandangan buruk (bahaya berkendara)",
  "kondisi_heavy_rain|angin_kencang": "Hujan deras + angin kencang (badai hujan)",
  "hampir_pasti_hujan|angin_kencang": "Hujan pasti + angin kencang",
}

const NGRAM_KEY_BOOST: Record<string, number> = {
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

function getNgramBoost(tokens: string[]): number {
  if (tokens.length !== 2) return 1.0
  const key = `${tokens[0]}|${tokens[1]}`
  const revKey = `${tokens[1]}|${tokens[0]}`
  return NGRAM_KEY_BOOST[key] ?? NGRAM_KEY_BOOST[revKey] ?? 1.0
}

function getNgramBoostReason(tokens: string[]): string {
  if (tokens.length !== 2) return "Tidak ada boost khusus"
  const key = `${tokens[0]}|${tokens[1]}`
  const revKey = `${tokens[1]}|${tokens[0]}`
  return NGRAM_DOMAIN_BOOST_REASONS[key] ?? NGRAM_DOMAIN_BOOST_REASONS[revKey] ?? "Tidak ada boost khusus"
}

function getSignificance(tfidf: number): "tinggi" | "sedang" | "rendah" {
  if (tfidf >= 0.15) return "tinggi"
  if (tfidf >= 0.08) return "sedang"
  return "rendah"
}

export function generateFeaturesXai(
  bigrams: Ngram[],
  trigrams: Ngram[],
  tfIdfTerms: TfIdfTerm[],
): FeaturesXai {
  const allNgrams = [...bigrams, ...trigrams]

  const seen = new Set<string>()
  const ngramBoosts: NgramXaiItem[] = allNgrams
    .filter((ng) => {
      if (seen.has(ng.label)) return false
      seen.add(ng.label)
      return true
    })
    .map((ng) => {
      const baseScore = parseFloat((ng.score / (getNgramBoost(ng.tokens) || 1)).toFixed(4))
      const boost = getNgramBoost(ng.tokens)
      return {
        ngram: ng.label,
        baseScore,
        boost,
        finalScore: ng.score,
        boostReason: getNgramBoostReason(ng.tokens),
      }
    })

  const tfidfHighlights: TfidfXaiItem[] = tfIdfTerms.map((t) => ({
    term: t.term,
    tfidf: t.tfidf,
    significance: getSignificance(t.tfidf),
  }))

  return { ngramBoosts, tfidfHighlights }
}