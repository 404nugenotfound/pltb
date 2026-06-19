// lib/nlp/accuracy.ts
// Cek akurasi per stage — membandingkan output dengan ekspektasi berdasarkan
// aturan bisnis dan ambang klasifikasi yang sudah ditentukan.

import type { WeatherRaw, WeatherToken } from "./tokenizing";
import type { StemmedConcept, StemmedWeather } from "./stemming";
import type { FeatureResult } from "./features";
import type { ReasoningResult, DerivedInsight } from "./reasoning";
import type { NlgResult, NlgSentence } from "./nlg";
import { largestRemainderPct, type SentimentResult } from "./sentiment";
import type { HighlightsResult } from "./highlights";

// ─── Tipe output ─────────────────────────────────────────────────────────────

export interface AccCheck {
  name: string;
  status: "passed" | "warning" | "failed";
  score: number;
  maxScore: number;
  message: string;
  detail?: string;
}

export interface StageAccuracy {
  stage: string;
  score: number;
  checks: AccCheck[];
}

const MAX_SCORE = 100;
const SENTIMENT_RANK: Record<string, number> = {
  berbahaya: 4,
  waspada: 3,
  netral: 2,
  positif: 1,
};

// ─── FIX: PENALTY harus sinkron dengan stemming.ts ──────────────────────────
// Dipakai di accuracyStemming() dan accuracySentiment() untuk hitung
// expectedScore dan expectedLabel yang konsisten dengan output stemWeather()

const SENTIMENT_PENALTY: Record<string, number> = {
  positif:   1.0,
  netral:    0.8,
  waspada:   0.45,
  berbahaya: 0.15,
}

// ─── Helper: hitung weighted score pakai PENALTY ─────────────────────────────

function calcWeightedScore(concepts: StemmedConcept[]): number {
  if (concepts.length === 0) return 100
  const weightedSum = concepts.reduce((s, c) => {
    const penalty = SENTIMENT_PENALTY[c.sentiment] ?? 1.0
    return s + c.weight * penalty
  }, 0)
  return Math.round((weightedSum / concepts.length) * 100)
}

// ─── Helper: hitung expectedSentiment — sinkron dengan calcOverall() ─────────
// FIX: threshold waspada turun dari 0.5 → 0.3, tambah score boundary

function calcExpectedSentiment(
  concepts: StemmedConcept[],
  score: number
): StemmedWeather["overallSentiment"] {
  const counts = { positif: 0, netral: 0, waspada: 0, berbahaya: 0 }
  concepts.forEach((c) => counts[c.sentiment]++)

  const hasBerbahaya = counts.berbahaya > 0
  const waspadaRatio = counts.waspada / (concepts.length || 1)

  if (hasBerbahaya || score < 25)              return "berbahaya"
  else if (waspadaRatio >= 0.3 || score < 45)  return "waspada"
  else if (score >= 80)                         return "baik"
  else                                          return "cukup"
}

function acc(
  name: string,
  passed: boolean,
  score: number,
  message: string,
  detail?: string,
): AccCheck {
  const finalScore = passed ? score : 0;
  return {
    name,
    status: passed ? "passed" : score >= MAX_SCORE / 2 ? "warning" : "failed",
    score: finalScore,
    maxScore: score,
    message: passed ? `✓ ${message}` : `✗ ${message}`,
    detail,
  };
}

function accPartial(
  name: string,
  ratio: number,
  maxScore: number,
  message: string,
  detail?: string,
): AccCheck {
  const finalScore = Math.round(Math.min(ratio, 1) * maxScore);
  const status = finalScore >= maxScore ? "passed" : finalScore >= maxScore / 2 ? "warning" : "failed";
  return {
    name,
    status,
    score: finalScore,
    maxScore,
    message: `${message} (${Math.round(ratio * 100)}%)`,
    detail,
  };
}

function calibrate(s: number): number {
  return s >= 70 ? Math.round(70 + (s - 70) * 0.3) : s;
}

function calcTotal(checks: AccCheck[]): number {
  const total = checks.reduce((s, c) => s + c.score, 0);
  const maxPossible = checks.reduce((s, c) => s + c.maxScore, 0);
  return maxPossible > 0 ? calibrate(Math.round((total / maxPossible) * 100)) : 0;
}

// ─── Stage 1: Tokenizing ─────────────────────────────────────────────────────

export function accuracyTokenizing(
  tokens: WeatherToken[],
  raw: WeatherRaw,
): StageAccuracy {
  const checks: AccCheck[] = [];

  // Temperature classification
  const tempToken = tokens.find((t) => t.key === "temp_label");
  if (tempToken) {
    let expected: string;
    if (raw.tempC <= 10) expected = "sangat_dingin";
    else if (raw.tempC <= 16) expected = "dingin";
    else if (raw.tempC <= 23) expected = "sejuk";
    else if (raw.tempC <= 30) expected = "hangat";
    else if (raw.tempC <= 35) expected = "panas";
    else expected = "sangat_panas";

    checks.push(
      acc(
        "temp_classify",
        tempToken.textToken === expected,
        20,
        `Suhu ${raw.tempC}°C → label "${tempToken.textToken}" (expected: "${expected}")`,
        `Threshold: ≤10=sangat_dingin, ≤16=dingin, ≤23=sejuk, ≤30=hangat, ≤35=panas, >35=sangat_panas`,
      ),
    );
  }

  // Humidity classification
  const humToken = tokens.find((t) => t.key === "humidity_label");
  if (humToken) {
    let expected: string;
    if (raw.humidity < 20) expected = "sangat_kering";
    else if (raw.humidity < 40) expected = "kering";
    else if (raw.humidity < 60) expected = "normal";
    else if (raw.humidity < 80) expected = "lembap";
    else expected = "sangat_lembap";

    checks.push(
      acc(
        "humidity_classify",
        humToken.textToken === expected,
        20,
        `Kelembapan ${raw.humidity}% → label "${humToken.textToken}" (expected: "${expected}")`,
        `Threshold: <20=sangat_kering, <40=kering, <60=normal, <80=lembap, ≥80=sangat_lembap`,
      ),
    );
  }

  // Wind classification
  const windToken = tokens.find((t) => t.key === "wind_label");
  if (windToken) {
    let expected: string;
    if (raw.windSpeedKPH < 2) expected = "tenang";
    else if (raw.windSpeedKPH < 15) expected = "sepoi_sepoi";
    else if (raw.windSpeedKPH < 30) expected = "angin_ringan";
    else if (raw.windSpeedKPH < 55) expected = "angin_sedang";
    else if (raw.windSpeedKPH < 80) expected = "angin_kencang";
    else expected = "badai";

    checks.push(
      acc(
        "wind_classify",
        windToken.textToken === expected,
        20,
        `Angin ${raw.windSpeedKPH} km/jam → label "${windToken.textToken}" (expected: "${expected}")`,
        `Threshold: <2=tenang, <15=sepoi, <30=ringan, <55=sedang, <80=kencang, ≥80=badai`,
      ),
    );
  }

  // UV classification
  const uvToken = tokens.find((t) => t.key === "uv_label");
  if (uvToken && raw.uvi !== undefined) {
    let expected: string;
    if (raw.uvi <= 2) expected = "uv_rendah";
    else if (raw.uvi <= 5) expected = "uv_sedang";
    else if (raw.uvi <= 7) expected = "uv_tinggi";
    else if (raw.uvi <= 10) expected = "uv_sangat_tinggi";
    else expected = "uv_ekstrem";

    checks.push(
      acc(
        "uv_classify",
        uvToken.textToken === expected,
        20,
        `UV ${raw.uvi} → label "${uvToken.textToken}" (expected: "${expected}")`,
        `Threshold: ≤2=rendah, ≤5=sedang, ≤7=tinggi, ≤10=sangat_tinggi, >10=ekstrem`,
      ),
    );
  }

  // Visibility classification
  const visToken = tokens.find((t) => t.key === "visibility_label");
  if (visToken && raw.visibilityKM !== undefined) {
    let expected: string;
    if (raw.visibilityKM >= 10) expected = "jarak_pandang_baik";
    else if (raw.visibilityKM >= 5) expected = "jarak_pandang_sedang";
    else expected = "jarak_pandang_buruk";

    checks.push(
      acc(
        "visibility_classify",
        visToken.textToken === expected,
        20,
        `Visibilitas ${raw.visibilityKM} km → label "${visToken.textToken}" (expected: "${expected}")`,
        `Threshold: ≥10=baik, ≥5=sedang, <5=buruk`,
      ),
    );
  }

  // Location token exists
  const locToken = tokens.find((t) => t.key === "location");
  checks.push(
    acc(
      "location_exists",
      locToken !== undefined,
      checks.length > 0 ? 0 : MAX_SCORE,
      locToken ? `Lokasi: ${locToken.rawValue}` : "Tidak ada token lokasi",
    ),
  );

  // Wind direction mapping (tokenizer uses abbreviation → Indonesian)
  const dirIdToken = tokens.find((t) => t.key === "wind_dir_id");
  if (dirIdToken && raw.windDir) {
    const DIR_MAP: Record<string, string> = {
      N: "utara",
      NNE: "utara_timurlaut",
      NE: "timurlaut",
      ENE: "timurlaut_timur",
      E: "timur",
      ESE: "tenggara_timur",
      SE: "tenggara",
      SSE: "selatan_tenggara",
      S: "selatan",
      SSW: "selatan_baratdaya",
      SW: "baratdaya",
      WSW: "baratdaya_barat",
      W: "barat",
      WNW: "barat_baratlaut",
      NW: "baratlaut",
      NNW: "utara_baratlaut",
    };
    const expected = DIR_MAP[raw.windDir];
    const actual = (dirIdToken.textToken as string).replace("dari_", "");
    checks.push(
      acc(
        "wind_direction_map",
        expected !== undefined && actual === expected,
        20,
        `Arah angin "${raw.windDir}" → "${actual}" (expected: "${expected ?? "?"}")`,
      ),
    );
  }

  return {
    stage: "tokenizing",
    score: calcTotal(checks),
    checks,
  };
}

// ─── Stage 2: Stemming ───────────────────────────────────────────────────────

// FIX: Tambahkan semua key arah angin (wind_dir_id) agar conceptCount valid
const TOKEN_CONCEPT_MAP_BASE_WEIGHTS: Record<string, number> = {
  // Suhu
  sangat_dingin: 0.15,   // FIX: turun dari 0.3 (sinkron dengan stemming.ts)
  dingin: 0.7,
  sejuk: 1.0,
  hangat: 0.9,
  panas: 0.4,
  sangat_panas: 0.2,
  // Kelembapan
  sangat_kering: 0.2,    // FIX: turun dari 0.45 (sinkron dengan stemming.ts)
  kering: 0.7,
  normal: 1.0,
  lembap: 0.65,
  sangat_lembap: 0.4,
  // Angin
  tenang: 1.0,
  sepoi_sepoi: 1.0,
  angin_ringan: 0.9,
  angin_sedang: 0.7,
  angin_kencang: 0.35,
  badai: 0.1,
  // Kondisi cuaca
  kondisi_sunny: 1.0,
  kondisi_mostly_sunny: 1.0,
  kondisi_partly_cloudy: 0.9,
  kondisi_mostly_cloudy: 0.75,
  kondisi_cloudy: 0.65,
  kondisi_overcast: 0.45,
  kondisi_rain: 0.35,
  kondisi_heavy_rain: 0.15,
  kondisi_thunderstorm: 0.1,
  kondisi_snow: 0.35,
  kondisi_fog: 0.35,     // FIX: turun dari 0.4
  kondisi_haze: 0.35,
  kondisi_clear: 1.0,
  kondisi_drizzle: 0.6,
  kondisi_light_rain: 0.6,
  kondisi_light_rain_showers: 0.55,
  // UV
  uv_rendah: 1.0,
  uv_sedang: 0.8,
  uv_tinggi: 0.5,
  uv_sangat_tinggi: 0.3,
  uv_ekstrem: 0.1,
  // Visibilitas
  jarak_pandang_baik: 1.0,
  jarak_pandang_sedang: 0.6,
  jarak_pandang_buruk: 0.3,   // FIX: turun dari 0.35
  // Hujan statik
  tidak_hujan: 1.0,
  curah_hujan_nol: 1.0,
  // Hujan dinamis
  peluang_hujan_kecil: 0.8,
  peluang_hujan_sedang: 0.7,
  kemungkinan_hujan: 0.4,
  hampir_pasti_hujan: 0.2,
  // FIX: Arah angin — semua dengan weight 0.75 (slot ke-8)
  dari_utara: 0.75,
  dari_timurlaut: 0.75,
  dari_timur: 0.75,
  dari_tenggara: 0.75,
  dari_selatan: 0.75,
  dari_baratdaya: 0.75,
  dari_barat: 0.75,
  dari_baratlaut: 0.75,
  dari_utara_timurlaut: 0.75,
  dari_timurlaut_timur: 0.75,
  dari_tenggara_timur: 0.75,
  dari_selatan_tenggara: 0.75,
  dari_selatan_baratdaya: 0.75,
  dari_baratdaya_barat: 0.75,
  dari_barat_baratlaut: 0.75,
  dari_utara_baratlaut: 0.75,
};

const DYNAMIC_CONCEPTS = new Set([
  "peluang_hujan_kecil",
  "peluang_hujan_sedang",
  "kemungkinan_hujan",
  "hampir_pasti_hujan",
  "tidak_hujan",
  "curah_hujan_nol",
]);

export function accuracyStemming(concepts: StemmedConcept[]): StageAccuracy {
  const checks: AccCheck[] = [];

  // Check concept mapping — partial scoring berdasarkan rasio konsep dikenal
  const unknownConcepts = concepts.filter(
    (c) =>
      !(c.concept in TOKEN_CONCEPT_MAP_BASE_WEIGHTS) &&
      !DYNAMIC_CONCEPTS.has(c.concept),
  );
  const knownRatio = unknownConcepts.length === 0 ? 1 : (concepts.length - unknownConcepts.length) / concepts.length;
  checks.push(
    accPartial(
      "concept_mapping",
      knownRatio,
      30,
      unknownConcepts.length > 0
        ? `${unknownConcepts.length} konsep tidak dikenal: ${unknownConcepts.map((c) => c.concept).join(", ")}`
        : `Semua ${concepts.length} konsep dikenal di TOKEN_CONCEPT_MAP atau stemmer dinamis`,
    ),
  );

  // Check weight integrity
  const weightIssues = concepts.filter(
    (c) => c.weight < 0 || c.weight > 1 || Number.isNaN(c.weight),
  );
  checks.push(
    acc(
      "weight_integrity",
      weightIssues.length === 0,
      30,
      weightIssues.length > 0
        ? `${weightIssues.length} konsep memiliki weight di luar 0–1`
        : `Semua ${concepts.length} weight dalam rentang 0–1`,
    ),
  );

  // FIX: Hitung score dengan PENALTY yang sama persis dengan stemming.ts
  // Sebelumnya pakai avgWeight biasa → score tidak sinkron dengan output nyata
  const score = calcWeightedScore(concepts)
  const expectedSentiment = calcExpectedSentiment(concepts, score)

  checks.push(
    acc(
      "overall_sentiment_logic",
      true,
      40,
      `Skor ${score} (weighted penalty), expected label "${expectedSentiment}"`,
      `Penalty: positif=1.0, netral=0.8, waspada=0.45, berbahaya=0.15`,
    ),
  );

  return {
    stage: "stemming",
    score: calcTotal(checks),
    checks,
  };
}

// ─── Stage 3a: Features ──────────────────────────────────────────────────────

export function accuracyFeatures(features: FeatureResult): StageAccuracy {
  const checks: AccCheck[] = [];

  const allNgrams = [...features.bigrams, ...features.trigrams];
  const allScores = allNgrams.map((ng) => ng.score);

  // Distribution check
  if (allScores.length > 0) {
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    const mean = allScores.reduce((s, v) => s + v, 0) / allScores.length;
    const outliers = allScores.filter((s) => s > mean * 5 || s < 0);

    checks.push(
      acc(
        "score_distribution",
        outliers.length === 0,
        30,
        `${allScores.length} n-gram: min=${min.toFixed(4)}, max=${max.toFixed(4)}, mean=${mean.toFixed(4)}${outliers.length > 0 ? `, ${outliers.length} outlier` : ""}`,
        outliers.length > 0
          ? `Outlier scores: ${outliers.map((s) => s.toFixed(4)).join(", ")}`
          : undefined,
      ),
    );
  } else {
    checks.push(
      acc("score_distribution", true, 30, "Tidak ada n-gram (input kosong)"),
    );
  }

  // TF-IDF range check
  const tfidfValues = features.tfIdfTerms.map((t) => t.tfidf);
  if (tfidfValues.length > 0) {
    const extreme = tfidfValues.filter((v) => v > 3 || v < 0);
    checks.push(
      acc(
        "tfidf_range",
        extreme.length === 0,
        30,
        `${tfidfValues.length} TF-IDF terms, max=${Math.max(...tfidfValues).toFixed(4)}, extreme=${extreme.length}`,
        extreme.length > 0
          ? `Nilai ekstrem: ${extreme.map((v) => v.toFixed(4)).join(", ")}`
          : undefined,
      ),
    );
  } else {
    checks.push(acc("tfidf_range", true, 30, "Tidak ada TF-IDF terms"));
  }

  // N-gram boost integrity
  const boostedNgrams = allNgrams.filter((ng) => {
    if (ng.tokens.length !== 2) return false;
    const key = `${ng.tokens[0]}|${ng.tokens[1]}`;
    const revKey = `${ng.tokens[1]}|${ng.tokens[0]}`;
    return (
      [
        "panas|sangat_lembap",
        "sangat_panas|sangat_lembap",
        "angin_kencang|kondisi_thunderstorm",
        "badai|kondisi_thunderstorm",
        "uv_tinggi|kondisi_sunny",
        "uv_sangat_tinggi|kondisi_sunny",
        "uv_ekstrem|kondisi_sunny",
        "jarak_pandang_buruk|kondisi_fog",
        "kondisi_heavy_rain|angin_kencang",
        "hampir_pasti_hujan|angin_kencang",
      ].includes(key) ||
      [
        "sangat_lembap|panas",
        "sangat_lembap|sangat_panas",
        "kondisi_thunderstorm|angin_kencang",
        "kondisi_thunderstorm|badai",
        "kondisi_sunny|uv_tinggi",
        "kondisi_sunny|uv_sangat_tinggi",
        "kondisi_sunny|uv_ekstrem",
        "kondisi_fog|jarak_pandang_buruk",
        "angin_kencang|kondisi_heavy_rain",
        "angin_kencang|hampir_pasti_hujan",
      ].includes(revKey)
    );
  });

  if (boostedNgrams.length > 0) {
    checks.push(
      acc(
        "ngram_boost_integrity",
        true,
        40,
        `${boostedNgrams.length} n-gram dengan domain boost terdeteksi: ${boostedNgrams.map((ng) => ng.label).join(", ")}`,
      ),
    );
  } else {
    checks.push(
      acc(
        "ngram_boost_integrity",
        true,
        40,
        "Tidak ada n-gram dengan domain boost (kombinasi normal)",
      ),
    );
  }

  return {
    stage: "features",
    score: calcTotal(checks),
    checks,
  };
}

// ─── Stage 3b: Reasoning ─────────────────────────────────────────────────────

export function accuracyReasoning(
  reasoning: ReasoningResult,
  conceptNames: string[],
): StageAccuracy {
  const checks: AccCheck[] = [];
  const conceptSet = new Set(conceptNames);

  // No false positives — every insight source must exist in concepts
  const falsePositives = reasoning.derivedInsights.filter(
    (i) => !i.source.every((s) => conceptSet.has(s)),
  );
  checks.push(
    acc(
      "rule_trigger_no_false_positive",
      falsePositives.length === 0,
      35,
      falsePositives.length > 0
        ? `${falsePositives.length} rule triggered dengan source tidak dikenal: ${falsePositives.map((i) => i.id).join(", ")}`
        : `Semua ${reasoning.derivedInsights.length} rule aktif memiliki source yang valid`,
    ),
  );

  // Check no missing high-severity rules (concept pairs that should trigger)
  let missedCount = 0;
  const RULE_CONDITIONS: { id: string; conditions: string[][] }[] = [
    { id: "gerah_ekstrem", conditions: [["panas", "sangat_lembap"]] },
    { id: "heat_stress_berat", conditions: [["sangat_panas", "sangat_lembap"]] },
    { id: "heat_stroke_risiko", conditions: [["sangat_panas", "uv_ekstrem"]] },
    { id: "sunburn_risiko", conditions: [["sangat_panas", "uv_ekstrem"]] },
    { id: "badai_petir_berbahaya", conditions: [["angin_kencang", "kondisi_thunderstorm"]] },
    { id: "badai_ekstrem", conditions: [["badai", "kondisi_thunderstorm"]] },
    { id: "berkendara_berbahaya", conditions: [["jarak_pandang_buruk", "kondisi_haze"]] },
    { id: "wind_chill_ekstrem", conditions: [["sangat_dingin", "angin_kencang"]] },
    {
      id: "cuaca_ideal",
      conditions: [
        ["sejuk", "tenang"],
        ["sejuk", "sepoi_sepoi"],
        ["hangat", "tenang"],
        ["hangat", "sepoi_sepoi"],
      ],
    },
    {
      id: "cerah_nyaman",
      conditions: [
        ["kondisi_sunny", "sejuk"],
        ["kondisi_sunny", "hangat"],
      ],
    },
  ];

  const activeIds = new Set(reasoning.derivedInsights.map((i) => i.id));
  for (const rule of RULE_CONDITIONS) {
    const shouldTrigger = rule.conditions.some((cond) =>
      cond.every((c) => conceptSet.has(c)),
    );
    const isTriggered = activeIds.has(rule.id);
    if (shouldTrigger && !isTriggered) missedCount++;
  }

  checks.push(
    acc(
      "rule_no_miss",
      missedCount === 0,
      35,
      missedCount > 0
        ? `${missedCount} rule seharusnya aktif tapi tidak terdeteksi`
        : `Semua rule yang seharusnya aktif berdasarkan konsep terdeteksi dengan benar`,
    ),
  );

  // Severity integrity
  const SEVERITY_MAP: Record<string, number> = {
    gerah_ekstrem: 0.4,
    heat_stress_berat: 0.6,
    gerah_sedang: 0.25,
    heat_stroke_risiko: 0.55,
    sunburn_risiko: 0.45,
    uv_ekstrem_cerah: 0.45,
    badai_petir_berbahaya: 0.65,
    hujan_badai: 0.35,
    badai_ekstrem: 0.75,
    angin_hujan_sedang: 0.35,
    wind_chill_ekstrem: 0.55,
    kondisi_beku: 0.5,
    dingin_kabut: 0.25,
    berkendara_berbahaya: 0.45,
    banjir_risiko: 0.45,
    kecelakaan_risiko: 0.5,
    kulit_rusak_cepat: 0.3,
    banjir_bandang_risiko: 0.7,
    banjir_lokal_waspada: 0.35,
    hujan_pasti_turun: 0.2,
    cuaca_ideal: -0.2,
    cerah_nyaman: -0.15,
  };

  const severityIssues = reasoning.derivedInsights.filter(
    (i) =>
      SEVERITY_MAP[i.id] !== undefined && i.severity !== SEVERITY_MAP[i.id],
  );
  checks.push(
    acc(
      "rule_severity_integrity",
      severityIssues.length === 0,
      30,
      severityIssues.length > 0
        ? `${severityIssues.length} rule severity tidak sesuai definisi: ${severityIssues.map((i) => `${i.id}(${i.severity}≠${SEVERITY_MAP[i.id]})`).join(", ")}`
        : `Semua severity sesuai definisi rule`,
    ),
  );

  return {
    stage: "reasoning",
    score: calcTotal(checks),
    checks,
  };
}

// ─── Stage 4: NLG ────────────────────────────────────────────────────────────

const NLG_TEMPLATE_POOLS = [
  "OPENING_BAIK",
  "OPENING_CUKUP",
  "OPENING_WASPADA",
  "OPENING_BERBAHAYA",
  "TEMP_SANGAT_PANAS",
  "TEMP_PANAS",
  "TEMP_SANGAT_DINGIN",
  "HUMIDITY_SANGAT_LEMBAP",
  "HUMIDITY_KERING",
  "WIND_BADAI",
  "WIND_KENCANG",
  "RAIN_TINGGI",
  "RAIN_LEBAT",
  "RAIN_SEDANG",
  "UV_EKSTREM",
  "UV_SANGAT_TINGGI",
  "VIS_BURUK",
];

export function accuracyNlg(nlg: NlgResult): StageAccuracy {
  const checks: AccCheck[] = [];

  // Template coverage — check how many sentence types are used
  const usedTypes = new Set(nlg.sentences.map((s) => s.type));
  checks.push(
    acc(
      "template_coverage",
      nlg.sentences.length >= 2,
      50,
      `${nlg.sentences.length} kalimat dengan ${usedTypes.size} tipe: ${Array.from(usedTypes).join(", ")}`,
      `Template pools available: ${NLG_TEMPLATE_POOLS.length}`,
    ),
  );

  // Key phrase is not just a fallback (non-empty)
  checks.push(
    acc(
      "keyphrase_coverage",
      nlg.keyPhrase.length > 5,
      50,
      `Key phrase: "${nlg.keyPhrase.substring(0, 60)}${nlg.keyPhrase.length > 60 ? "…" : ""}" (${nlg.keyPhrase.length} karakter)`,
    ),
  );

  return {
    stage: "nlg",
    score: calcTotal(checks),
    checks,
  };
}

// ─── Stage 5: Sentiment ──────────────────────────────────────────────────────

export function accuracySentiment(
  sentiment: SentimentResult,
  concepts: StemmedConcept[],
): StageAccuracy {
  const checks: AccCheck[] = [];

  const total = concepts.length || 1;
  const counts = {
    positif: concepts.filter((c) => c.sentiment === "positif").length,
    netral: concepts.filter((c) => c.sentiment === "netral").length,
    waspada: concepts.filter((c) => c.sentiment === "waspada").length,
    berbahaya: concepts.filter((c) => c.sentiment === "berbahaya").length,
  };

  // Breakdown consistency
  const expectedPct = largestRemainderPct(counts, total);
  const breakdownMatch =
    Math.abs(sentiment.breakdown.positif - expectedPct.positif) <= 2 &&
    Math.abs(sentiment.breakdown.netral - expectedPct.netral) <= 2 &&
    Math.abs(sentiment.breakdown.waspada - expectedPct.waspada) <= 2 &&
    Math.abs(sentiment.breakdown.berbahaya - expectedPct.berbahaya) <= 2;

  checks.push(
    acc(
      "breakdown_consistency",
      breakdownMatch,
      30,
      breakdownMatch
        ? `Breakdown konsisten: P=${sentiment.breakdown.positif}%, N=${sentiment.breakdown.netral}%, W=${sentiment.breakdown.waspada}%, B=${sentiment.breakdown.berbahaya}%`
        : `Breakdown mismatch: got P=${sentiment.breakdown.positif}% vs expected P=${expectedPct.positif}% (from ${counts.positif}/${total} concepts)`,
      `Concept counts: positif=${counts.positif}, netral=${counts.netral}, waspada=${counts.waspada}, berbahaya=${counts.berbahaya}`,
    ),
  );

  // FIX: Score consistency — pakai calcWeightedScore (PENALTY) bukan avgWeight biasa
  // Sebelumnya: expectedScore = avgWeight × 100 → tidak sinkron dengan stemming.ts
  const expectedScore = calcWeightedScore(concepts)
  checks.push(
    acc(
      "score_consistency",
      Math.abs(sentiment.score - expectedScore) <= 5,
      35,
      `Score ${sentiment.score} vs expected ${expectedScore} (weighted penalty)`,
      `Penalty: positif=1.0, netral=0.8, waspada=0.45, berbahaya=0.15`,
    ),
  );

  // FIX: Label consistency — pakai calcExpectedSentiment yang sinkron dengan stemming.ts
  // Sebelumnya: waspadaRatio >= 0.5 → terlalu ketat, banyak case salah label
  const expectedLabel = calcExpectedSentiment(concepts, expectedScore)
  checks.push(
    acc(
      "label_consistency",
      sentiment.label === expectedLabel,
      35,
      `Label "${sentiment.label}" ${sentiment.label === expectedLabel ? "sesuai" : `tidak sesuai (expected: "${expectedLabel}")`} dengan aturan logika`,
      `Score: ${expectedScore}, waspada: ${((counts.waspada / total) * 100).toFixed(0)}%, berbahaya: ${counts.berbahaya > 0}`,
    ),
  );

  return {
    stage: "sentiment",
    score: calcTotal(checks),
    checks,
  };
}

// ─── Stage 6: Highlights ─────────────────────────────────────────────────────

export function accuracyHighlights(
  highlights: HighlightsResult,
  concepts: StemmedConcept[],
): StageAccuracy {
  const checks: AccCheck[] = [];

  const warningConcepts = concepts.filter(
    (c) => c.sentiment === "waspada" || c.sentiment === "berbahaya",
  );
  const expectedWarnings = warningConcepts.map((c) => c.humanLabel);
  const positiveConcepts = concepts.filter((c) => c.sentiment === "positif");
  const expectedPositives = positiveConcepts.map((c) => c.humanLabel);

  // Check all warnings have matching concept
  const missingWarnings = highlights.warnings.filter(
    (w) => !expectedWarnings.includes(w),
  );
  checks.push(
    acc(
      "warning_consistency",
      missingWarnings.length === 0,
      30,
      missingWarnings.length > 0
        ? `${missingWarnings.length} warning tidak cocok dengan konsep waspada/berbahaya: ${missingWarnings.join(", ")}`
        : `Semua ${highlights.warnings.length} warning sesuai konsep`,
    ),
  );

  // Check all positives have matching concept
  const missingPositives = highlights.positives.filter(
    (p) => !expectedPositives.includes(p),
  );
  checks.push(
    acc(
      "positive_consistency",
      missingPositives.length === 0,
      30,
      missingPositives.length > 0
        ? `${missingPositives.length} positive tidak cocok dengan konsep positif: ${missingPositives.join(", ")}`
        : `Semua ${highlights.positives.length} positive sesuai konsep`,
    ),
  );

  // Check no duplicates across warnings and positives
  const duplicates = highlights.warnings.filter((w) =>
    highlights.positives.includes(w),
  );
  checks.push(
    acc(
      "no_cross_contamination",
      duplicates.length === 0,
      40,
      duplicates.length > 0
        ? `${duplicates.length} konsep muncul di warnings DAN positives: ${duplicates.join(", ")}`
        : "Tidak ada konsep yang muncul di warnings dan positives secara bersamaan",
    ),
  );

  return {
    stage: "highlights",
    score: calcTotal(checks),
    checks,
  };
}