import { FIXTURES } from "./__tests__/fixtures/index"
import { processWeatherNlp } from "./pipeline"

interface FixtureCheck {
  fixtureId: string
  area: string
  score: number
  maxScore: number
  detail: string
}

export interface FixtureAccuracyResult {
  passed: number
  total: number
  score: number
  failures: Array<{ fixtureId: string; area: string; detail: string }>
}

const STOPWORDS = new Set(["dan", "di", "ke", "dari", "yang", "ini", "itu", "dan", "atau", "tidak", "akan", "sangat", "lebih", "ada", "dengan", "untuk", "dalam", "pada", "adalah", "bisa", "kalau", "masih", "juga", "udara", "terasa", "sekitar", "perlu"])

function getKeywords(text: string): string[] {
  return text.toLowerCase().split(/[\s,()]+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
}

export function calcFixtureAccuracy(): FixtureAccuracyResult {
  const allResults: FixtureCheck[] = []

  for (const fixture of FIXTURES) {
    const result = processWeatherNlp(fixture.input)
    const pipeline = result.pipeline
    const r: FixtureCheck[] = []
    const fixtureId = fixture.id

    const stemmed = pipeline.step3_stemmed
    if (stemmed) {
      const exStem = fixture.expected.stemmed

      r.push({
        fixtureId, area: "stemming/sentiment",
        score: stemmed.overallSentiment === exStem.overallSentiment ? 4 : 0, maxScore: 4,
        detail: `sentiment="${stemmed.overallSentiment}" expected="${exStem.overallSentiment}"`,
      })

      r.push({
        fixtureId, area: "stemming/score",
        score: stemmed.overallScore >= exStem.overallScoreMin && stemmed.overallScore <= exStem.overallScoreMax ? 4 : 0, maxScore: 4,
        detail: `score=${stemmed.overallScore} expected=${exStem.overallScoreMin}-${exStem.overallScoreMax}`,
      })

      r.push({
        fixtureId, area: "stemming/conceptCount",
        score: (stemmed.concepts?.length ?? 0) === exStem.conceptCount ? 4 : 0, maxScore: 4,
        detail: `count=${stemmed.concepts?.length} expected=${exStem.conceptCount}`,
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
          fixtureId, area: "stemming/sentimentCounts",
          score: match ? 4 : 0, maxScore: 4,
          detail: `got P=${sentiments.positif} N=${sentiments.netral} W=${sentiments.waspada} B=${sentiments.berbahaya} expected P=${exStem.sentiments.positif} N=${exStem.sentiments.netral} W=${exStem.sentiments.waspada} B=${exStem.sentiments.berbahaya}`,
        })
      }
    }

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
          fixtureId, area: "reasoning/rules",
          score: 0, maxScore: 6,
          detail: parts.join("; "),
        })
      } else {
        r.push({
          fixtureId, area: "reasoning/rules",
          score: 6, maxScore: 6,
          detail: `active=[${activeIds.join(",")}]`,
        })
      }

      r.push({
        fixtureId, area: "reasoning/score",
        score: reasoning.adjustedScore >= exReas.adjustedScoreMin ? 4 : 0, maxScore: 4,
        detail: `score=${reasoning.adjustedScore} expected>=${exReas.adjustedScoreMin}`,
      })

      r.push({
        fixtureId, area: "reasoning/sentiment",
        score: reasoning.adjustedSentiment === exReas.adjustedSentiment ? 4 : 0, maxScore: 4,
        detail: `sentiment="${reasoning.adjustedSentiment}" expected="${exReas.adjustedSentiment}"`,
      })
    }

    const nlgResult = pipeline.step4_nlg
    const nlpData = pipeline.step4_nlp
    if (nlgResult && fixture.expected.nlg) {
      const exNLG = fixture.expected.nlg

      const narrativeLower = nlgResult.narrative.toLowerCase()
      const kwMatchCount = exNLG.narrativeHints.filter(h => narrativeLower.includes(h.toLowerCase())).length
      const targetCount = Math.min(2, exNLG.narrativeHints.length)
      const narrRatio = Math.min(kwMatchCount / targetCount, 1)
      r.push({
        fixtureId, area: "nlg/narrativeHints",
        score: Math.round(narrRatio * 15), maxScore: 15,
        detail: `found=${kwMatchCount}/${exNLG.narrativeHints.length} target≥${targetCount}`,
      })

      const kpLower = nlgResult.keyPhrase.toLowerCase()
      const kpHits = exNLG.keyPhraseHints.filter(h => kpLower.includes(h.toLowerCase())).length
      const kpRatio = Math.min(kpHits / exNLG.keyPhraseHints.length, 1)
      r.push({
        fixtureId, area: "nlg/keyPhrase",
        score: Math.round(kpRatio * 30), maxScore: 30,
        detail: `keyPhrase="${nlgResult.keyPhrase}" hits=${kpHits}/${exNLG.keyPhraseHints.length}`,
      })

      const adviceLen = nlpData?.advice?.length ?? 0
      const adviceDiff = Math.abs(adviceLen - exNLG.adviceCount)
      const adviceRatio = Math.max(0, 1 - adviceDiff / Math.max(exNLG.adviceCount, 1))
      r.push({
        fixtureId, area: "nlg/adviceCount",
        score: Math.round(adviceRatio * 10), maxScore: 10,
        detail: `count=${adviceLen} expected~${exNLG.adviceCount}`,
      })

      if (stemmed?.concepts) {
        const narrativeKeywords = new Set(getKeywords(nlgResult.narrative))
        const matchedConcepts = stemmed.concepts.filter(c => {
          const cKeywords = getKeywords(c.humanLabel)
          return cKeywords.some(kw => narrativeKeywords.has(kw))
        })
        const coverageRatio = stemmed.concepts.length > 0 ? matchedConcepts.length / stemmed.concepts.length : 0
        r.push({
          fixtureId, area: "nlg/conceptCoverage",
          score: Math.round(coverageRatio * 30), maxScore: 30,
          detail: `matched=${matchedConcepts.length}/${stemmed.concepts.length} concepts in narrative`,
        })
      }

      const sentenceCount = Math.max(1, (nlgResult.narrative.match(/[.!?]+/g) || []).length)
      const sentenceRatio = Math.min(sentenceCount / 2, 1)
      r.push({
        fixtureId, area: "nlg/sentenceVariety",
        score: Math.round(sentenceRatio * 15), maxScore: 15,
        detail: `sentences=${sentenceCount} target≥2`,
      })
    }

    if (nlpData?.highlights) {
      const exHL = fixture.expected.highlights
      const warnCount = nlpData.highlights.warnings?.length ?? 0
      const posCount = nlpData.highlights.positives?.length ?? 0

      r.push({
        fixtureId, area: "highlights/warnings",
        score: warnCount >= exHL.warningCount - 1 && warnCount <= exHL.warningCount + 1 ? 5 : 0, maxScore: 5,
        detail: `count=${warnCount} expected~${exHL.warningCount}`,
      })

      r.push({
        fixtureId, area: "highlights/positives",
        score: posCount >= exHL.positiveCount - 1 && posCount <= exHL.positiveCount + 1 ? 5 : 0, maxScore: 5,
        detail: `count=${posCount} expected~${exHL.positiveCount}`,
      })
    }

    allResults.push(...r)
  }

  const totalAchieved = allResults.reduce((s, c) => s + c.score, 0)
  const totalMax = allResults.reduce((s, c) => s + c.maxScore, 0)
  const failures = allResults.filter((c) => c.score < c.maxScore).map(({ fixtureId, area, detail }) => ({ fixtureId, area, detail }))
  const passedCount = allResults.filter((c) => c.score >= c.maxScore).length

  return {
    passed: passedCount,
    total: allResults.length,
    score: totalMax > 0 ? Math.round((totalAchieved / totalMax) * 100) : 0,
    failures,
  }
}