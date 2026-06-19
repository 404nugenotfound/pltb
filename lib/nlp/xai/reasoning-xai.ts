// lib/nlp/xai/reasoning-xai.ts
// XAI: Tampilkan rule mana yang aktif dari 21+ rule reasoning engine
// User bisa melihat kondisi apa yang terpenuhi dan dampaknya ke skor

import type { DerivedInsight } from "../reasoning"
import type { ReasoningXai, ReasoningXaiItem } from "./types"

const TOTAL_RULES = 22

function describeImpact(severity: number): string {
  if (severity < 0) return `Menurunkan skor ${Math.abs(severity).toFixed(2)} (kondisi positif)`
  if (severity === 0) return "Tidak ada dampak"
  return `Meningkatkan skor +${severity.toFixed(2)}`
}

export function generateReasoningXai(
  derivedInsights: DerivedInsight[],
): ReasoningXai {
  const activeRules: ReasoningXaiItem[] = derivedInsights.map((insight) => ({
    ruleId: insight.id,
    label: insight.label,
    matchedConditions: insight.source,
    severity: insight.severity,
    impactDescription: describeImpact(insight.severity),
    advice: insight.advice,
  }))

  return {
    activeRules,
    totalRules: TOTAL_RULES,
  }
}