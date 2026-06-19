// lib/nlp/processing.ts
// ⚠️ DEPRECATED — Gunakan pipeline.ts untuk entry point tunggal.
// File ini dipertahankan untuk backward compatibility.
//
// Pipeline lengkap:
//   tokenizing → stemming → features → reasoning → analysis → nlg → sentiment + highlights

export { tokenizeWeather, type WeatherRaw, type WeatherToken } from "./tokenizing"
export { stemWeather, getAdviceList, getConceptsBySentiment, type StemmedConcept, type StemmedWeather } from "./stemming"
export { extractFeatures, type Ngram, type TfIdfTerm, type FeatureResult } from "./features"
export { reasonWeather, type DerivedInsight, type ReasoningResult } from "./reasoning"
export { analyzeWeather, type AnalysisResult } from "./analysis"
export { generateNlg, type NlgSentence, type NlgResult } from "./nlg"
export { analyzeSentiment, type SentimentResult } from "./sentiment"
export { buildHighlights, type HighlightsResult } from "./highlights"
export { ensurePlaceName, normalizePlaceName } from "./normalize"
export { processWeatherNlp, type PipelineResult, type PipelineStepLog } from "./pipeline"
export {
  validateTokenizing, validateStemming, validateFeatures,
  validateReasoning, validateNlg, validateSentiment, validateHighlights,
  type StageValidation, type ValCheck,
} from "./validation"
export {
  accuracyTokenizing, accuracyStemming, accuracyFeatures,
  accuracyReasoning, accuracyNlg, accuracySentiment, accuracyHighlights,
  type StageAccuracy, type AccCheck,
} from "./accuracy"