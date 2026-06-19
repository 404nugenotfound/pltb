// lib/nlp/xai/stemming-xai.ts
// XAI: Ekspos bobot konsep — base weight dari TOKEN_CONCEPT_MAP
// dan boost dari reasoning engine (jika ada)

import type { StemmedConcept } from "../stemming"
import type { DerivedInsight } from "../reasoning"
import type { StemmingXai, StemmingXaiItem } from "./types"

export function generateStemmingXai(
  concepts: StemmedConcept[],
  derivedInsights: DerivedInsight[],
  adjustedScore: number,
): StemmingXai {
  // Build map: concept → total boost amount + source rule labels
  const boostMap = new Map<string, { amount: number; sources: string[] }>()

  for (const insight of derivedInsights) {
    for (const source of insight.source) {
      const existing = boostMap.get(source) ?? { amount: 0, sources: [] }
      existing.amount = Math.max(existing.amount, insight.severity)
      existing.sources.push(`${insight.id}: ${insight.label}`)
      boostMap.set(source, existing)
    }
  }

  // TOKEN_CONCEPT_MAP base weights (reconstructed from stemming.ts logic)
  const BASE_WEIGHTS: Record<string, number> = {
    sangat_dingin: 0.9, dingin: 0.7, sejuk: 1.0, hangat: 1.0,
    panas: 0.6, sangat_panas: 0.2,
    sangat_kering: 0.5, kering: 0.7, normal: 1.0, lembap: 0.8, sangat_lembap: 0.5,
    tenang: 1.0, sepoi_sepoi: 1.0, angin_ringan: 0.9, angin_sedang: 0.7,
    angin_kencang: 0.4, badai: 0.1,
    kondisi_sunny: 1.0, kondisi_mostly_sunny: 1.0, kondisi_partly_cloudy: 0.9,
    kondisi_mostly_cloudy: 0.8, kondisi_cloudy: 0.7, kondisi_overcast: 0.6,
    kondisi_rain: 0.4, kondisi_heavy_rain: 0.2, kondisi_thunderstorm: 0.1,
    kondisi_snow: 0.4, kondisi_fog: 0.5, kondisi_haze: 0.5, kondisi_clear: 1.0,
    kondisi_drizzle: 0.6,
    uv_rendah: 1.0, uv_sedang: 0.8, uv_tinggi: 0.5, uv_sangat_tinggi: 0.3, uv_ekstrem: 0.1,
    jarak_pandang_baik: 1.0, jarak_pandang_sedang: 0.6, jarak_pandang_buruk: 0.3,
    tidak_hujan: 1.0, curah_hujan_nol: 1.0,
    peluang_hujan_kecil: 0.8, peluang_hujan_sedang: 0.7,
    kemungkinan_hujan: 0.4, hampir_pasti_hujan: 0.2,
  }

  const items: StemmingXaiItem[] = concepts.map((c) => {
    const baseWeight = BASE_WEIGHTS[c.concept] ?? c.weight
    const boostInfo = boostMap.get(c.concept)
    const boostAmount = boostInfo ? parseFloat(boostInfo.amount.toFixed(2)) : 0
    const finalWeight = parseFloat(Math.min(c.weight, 1.0).toFixed(2))

    return {
      concept: c.concept,
      humanLabel: c.humanLabel,
      sentiment: c.sentiment,
      baseWeight,
      finalWeight,
      boostAmount,
      boostSources: boostInfo?.sources ?? [],
    }
  })

  return { concepts: items }
}