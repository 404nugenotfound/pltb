import { describe, it, expect } from "vitest"
import { processWeatherNlp } from "@/lib/nlp/pipeline"
import { FIXTURES } from "./fixtures/index"

interface CheckResult {
  fixtureId: string
  area: string
  passed: boolean
  detail: string
}

const ALL_RESULTS: CheckResult[] = []

describe("NLP Pipeline Accuracy", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.id}: ${fixture.label}`, () => {
      const result = processWeatherNlp(fixture.input)
      const pipeline = result.pipeline
      const r: CheckResult[] = []

      // -- Stemming --------------------------------------------------------------
      const stemmed = pipeline.step3_stemmed
      if (stemmed) {
        const exStem = fixture.expected.stemmed

        r.push({
          fixtureId: fixture.id, area: "stemming/sentiment",
          passed: stemmed.overallSentiment === exStem.overallSentiment,
          detail: `sentiment="${stemmed.overallSentiment}" expected="${exStem.overallSentiment}"`,
        })

        r.push({
          fixtureId: fixture.id, area: "stemming/score",
          passed: stemmed.overallScore >= exStem.overallScoreMin && stemmed.overallScore <= exStem.overallScoreMax,
          detail: `score=${stemmed.overallScore} expected=${exStem.overallScoreMin}-${exStem.overallScoreMax}`,
        })

        const conceptCount = stemmed.concepts?.length ?? 0
        r.push({
          fixtureId: fixture.id, area: "stemming/conceptCount",
          passed: conceptCount === exStem.conceptCount,
          detail: `count=${conceptCount} expected=${exStem.conceptCount}`,
        })

        if (stemmed.concepts) {
          const sentiments = { positif: 0, netral: 0, waspada: 0, berbahaya: 0 }
          for (const c of stemmed.concepts) {
            if (c.sentiment in sentiments) sentiments[c.sentiment as keyof typeof sentiments]++
          }
          const match =
            sentiments.positif === exStem.sentiments.positif &&
            sentiments.netral === exStem.sentiments.netral &&
            sentiments.waspada === exStem.sentiments.waspada &&
            sentiments.berbahaya === exStem.sentiments.berbahaya

          r.push({
            fixtureId: fixture.id, area: "stemming/sentimentCounts",
            passed: match,
            detail: `got P=${sentiments.positif} N=${sentiments.netral} W=${sentiments.waspada} B=${sentiments.berbahaya} expected P=${exStem.sentiments.positif} N=${exStem.sentiments.netral} W=${exStem.sentiments.waspada} B=${exStem.sentiments.berbahaya}`,
          })
        }
      }

      // -- Reasoning ------------------------------------------------------------
      const reasoning = pipeline.step3b_reasoning
      if (reasoning) {
        const exReas = fixture.expected.reasoning
        const activeIds = reasoning.derivedInsights?.map((i: { id: string }) => i.id) ?? []
        const expectedSorted = [...exReas.activeRuleIds].sort()
        const actualSorted = [...activeIds].sort()
        const ruleMatch = JSON.stringify(actualSorted) === JSON.stringify(expectedSorted)

        if (!ruleMatch) {
          const missing = expectedSorted.filter((r) => !actualSorted.includes(r))
          const extra = actualSorted.filter((r) => !expectedSorted.includes(r))
          const parts: string[] = []
          if (missing.length) parts.push(`missing: ${missing.join(",")}`)
          if (extra.length) parts.push(`extra: ${extra.join(",")}`)
          r.push({
            fixtureId: fixture.id, area: "reasoning/rules",
            passed: false,
            detail: parts.join("; "),
          })
        } else {
          r.push({
            fixtureId: fixture.id, area: "reasoning/rules",
            passed: true,
            detail: `active=[${activeIds.join(",")}]`,
          })
        }

        r.push({
          fixtureId: fixture.id, area: "reasoning/score",
          passed: reasoning.adjustedScore >= exReas.adjustedScoreMin,
          detail: `score=${reasoning.adjustedScore} expected>=${exReas.adjustedScoreMin}`,
        })

        r.push({
          fixtureId: fixture.id, area: "reasoning/sentiment",
          passed: reasoning.adjustedSentiment === exReas.adjustedSentiment,
          detail: `sentiment="${reasoning.adjustedSentiment}" expected="${exReas.adjustedSentiment}"`,
        })
      }

      // -- NLG -----------------------------------------------------------------
      const nlgResult = pipeline.step4_nlg
      const nlpData = pipeline.step4_nlp
      if (nlgResult && fixture.expected.nlg) {
        const exNLG = fixture.expected.nlg

        const narrativeLower = nlgResult.narrative.toLowerCase()
        const kwMatchCount = exNLG.narrativeHints.filter(h => narrativeLower.includes(h.toLowerCase())).length
        r.push({
          fixtureId: fixture.id, area: "nlg/narrativeHints",
          passed: kwMatchCount >= Math.min(2, exNLG.narrativeHints.length),
          detail: `found=${kwMatchCount}/${exNLG.narrativeHints.length}`,
        })

        const kpLower = nlgResult.keyPhrase.toLowerCase()
        const kpMatch = exNLG.keyPhraseHints.some(h => kpLower.includes(h.toLowerCase()))
        r.push({
          fixtureId: fixture.id, area: "nlg/keyPhrase",
          passed: kpMatch,
          detail: `keyPhrase="${nlgResult.keyPhrase}"`,
        })

        const adviceLen = nlpData?.advice?.length ?? 0
        r.push({
          fixtureId: fixture.id, area: "nlg/adviceCount",
          passed: adviceLen >= exNLG.adviceCount - 2 && adviceLen <= exNLG.adviceCount + 2,
          detail: `count=${adviceLen} expected~${exNLG.adviceCount}`,
        })
      }

      // -- Highlights -----------------------------------------------------------
      if (nlpData?.highlights) {
        const exHL = fixture.expected.highlights
        const warnCount = nlpData.highlights.warnings?.length ?? 0
        const posCount = nlpData.highlights.positives?.length ?? 0

        r.push({
          fixtureId: fixture.id, area: "highlights/warnings",
          passed: warnCount >= exHL.warningCount - 1 && warnCount <= exHL.warningCount + 1,
          detail: `count=${warnCount} expected~${exHL.warningCount}`,
        })

        r.push({
          fixtureId: fixture.id, area: "highlights/positives",
          passed: posCount >= exHL.positiveCount - 1 && posCount <= exHL.positiveCount + 1,
          detail: `count=${posCount} expected~${exHL.positiveCount}`,
        })
      }

      ALL_RESULTS.push(...r)

      const passed = r.filter((x) => x.passed).length
      const total = r.length
      const pct = Math.round((passed / total) * 100)
      console.log(`  ${pct >= 80 ? "PASS" : pct >= 50 ? "WARN" : "FAIL"} ${fixture.id}: ${passed}/${total} (${pct}%)`)

      expect(passed / total).toBeGreaterThan(0.3)
    })
  }
})

describe("NLP Pipeline Accuracy Report", () => {
  it("generates final summary", () => {
    const total = ALL_RESULTS.length
    const passed = ALL_RESULTS.filter((r) => r.passed).length
    const pct = Math.round((passed / total) * 100)

    console.log(`\n${"=".repeat(55)}`)
    console.log(`ACCURACY REPORT: ${passed}/${total} checks passed (${pct}%)`)
    console.log(`Fixtures: ${FIXTURES.length}`)
    console.log(`Areas: stemming, reasoning, highlights`)

    const byArea: Record<string, { passed: number; total: number }> = {}
    for (const r of ALL_RESULTS) {
      if (!byArea[r.area]) byArea[r.area] = { passed: 0, total: 0 }
      byArea[r.area].passed += r.passed ? 1 : 0
      byArea[r.area].total++
    }
    for (const [area, stats] of Object.entries(byArea).sort()) {
      const aPct = Math.round((stats.passed / stats.total) * 100)
      const icon = aPct >= 80 ? "PASS" : aPct >= 50 ? "WARN" : "FAIL"
      console.log(`  ${icon} ${area}: ${stats.passed}/${stats.total} (${aPct}%)`)
    }

    const failures = ALL_RESULTS.filter((r) => !r.passed)
    if (failures.length > 0) {
      console.log(`\nFailures:`)
      for (const r of failures) {
        console.log(`  ${r.fixtureId} ${r.area}: ${r.detail}`)
      }
    }
    console.log(`${"=".repeat(55)}`)

    expect(total).toBeGreaterThan(0)
  })
})