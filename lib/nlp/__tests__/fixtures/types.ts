
import type { WeatherRaw } from "@/lib/nlp/tokenizing"

export interface PipelineExpectation {
  tokens: {
    temp_label: string
    humidity_label: string
    wind_label: string
    uv_label: string
    visibility_label: string
  }
  stemmed: {
    conceptCount: number
    sentiments: {
      positif: number
      netral: number
      waspada: number
      berbahaya: number
    }
    overallSentiment: string
    overallScoreMin: number
    overallScoreMax: number
  }
  reasoning: {
    activeRuleIds: string[]
    adjustedScoreMin: number
    adjustedSentiment: string
  }
  highlights: {
    warningCount: number
    positiveCount: number
  }
  nlg?: {
    narrativeHints: string[]
    keyPhraseHints: string[]
    adviceCount: number
  }
}

export interface WeatherFixture {
  id: string
  label: string
  input: WeatherRaw
  expected: PipelineExpectation
}