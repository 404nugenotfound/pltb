// lib\nlp\__tests__\fixtures\index.ts
import type { WeatherFixture } from "./types";

export const FIXTURES: WeatherFixture[] = [
  {
    id: "case-001",
    label: "Cerah sejuk -- kondisi ideal",
    input: {
      tempC: 24, tempF: 75, feelslikeC: 23, feelslikeF: 73,
      humidity: 50, weatherPrimary: "Sunny",
      windSpeedKPH: 8, windSpeedMPH: 5, windDir: "N", windDirDEG: 0, windGustKPH: 12,
      uvi: 3, visibilityKM: 20, pop: 0, sky: 10,
      place: { name: "Jakarta", state: "DKI Jakarta", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "sejuk", humidity_label: "normal", wind_label: "sepoi_sepoi",
        uv_label: "uv_sedang", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8 (slot wind_dir_id)
        sentiments: { positif: 6, netral: 2, waspada: 0, berbahaya: 0 }, // FIX: N 1→2
        overallSentiment: "baik",
        overallScoreMin: 85, overallScoreMax: 100,
      },
      reasoning: {
        activeRuleIds: ["cerah_nyaman", "cuaca_ideal"],
        adjustedScoreMin: 95, adjustedSentiment: "baik",
      },
      highlights: { warningCount: 0, positiveCount: 6 },
      nlg: {
        narrativeHints: ["cerah", "sejuk", "nyaman", "ideal"],
        keyPhraseHints: ["Cerah", "Nyaman", "Ideal"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-002",
    label: "Panas lembap -- gerah",
    input: {
      tempC: 34, tempF: 93, feelslikeC: 37, feelslikeF: 99,
      humidity: 82, weatherPrimary: "Partly Cloudy",
      windSpeedKPH: 15, windSpeedMPH: 9, windDir: "NE", windDirDEG: 45, windGustKPH: 22,
      uvi: 8, visibilityKM: 15, pop: 10, sky: 60,
      place: { name: "Surabaya", state: "Jawa Timur", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "panas", humidity_label: "sangat_lembap", wind_label: "angin_ringan",
        uv_label: "uv_sangat_tinggi", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 3, netral: 2, waspada: 3, berbahaya: 0 }, // FIX: N 1→2
        overallSentiment: "waspada",
        overallScoreMin: 55, overallScoreMax: 70,
      },
      reasoning: {
        activeRuleIds: ["gerah_ekstrem", "sunburn_risiko"],
        adjustedScoreMin: 88, adjustedSentiment: "waspada",
      },
      highlights: { warningCount: 3, positiveCount: 3 },
      nlg: {
        narrativeHints: ["panas", "lembap", "gerah", "UV"],
        keyPhraseHints: ["Gerah", "Sunburn"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-003",
    label: "Badai petir ekstrem",
    input: {
      tempC: 28, tempF: 82, feelslikeC: 29, feelslikeF: 84,
      humidity: 90, weatherPrimary: "Thunderstorm",
      windSpeedKPH: 85, windSpeedMPH: 53, windDir: "W", windDirDEG: 270, windGustKPH: 110,
      uvi: 1, visibilityKM: 3, pop: 95, sky: 100,
      place: { name: "Bandung", state: "Jawa Barat", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "sangat_lembap", wind_label: "badai",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_buruk",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 2, netral: 1, waspada: 3, berbahaya: 2 }, // FIX: N 0→1
        overallSentiment: "berbahaya",
        overallScoreMin: 30, overallScoreMax: 45,
      },
      reasoning: {
        activeRuleIds: ["badai_ekstrem"],
        adjustedScoreMin: 80, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 5, positiveCount: 2 },
      nlg: {
        narrativeHints: ["badai", "petir", "angin", "berbahaya"],
        keyPhraseHints: ["Badai"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-004",
    label: "Dingin berkabut -- jarak pandang rendah",
    input: {
      tempC: 12, tempF: 54, feelslikeC: 10, feelslikeF: 50,
      humidity: 85, weatherPrimary: "Fog",
      windSpeedKPH: 5, windSpeedMPH: 3, windDir: "S", windDirDEG: 180, windGustKPH: 8,
      uvi: 0, visibilityKM: 0.5, pop: 0, sky: 95,
      place: { name: "Malang", state: "Jawa Timur", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "dingin", humidity_label: "sangat_lembap", wind_label: "tenang",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_buruk",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 3, netral: 2, waspada: 3, berbahaya: 0 }, // FIX: N 1→2
        overallSentiment: "waspada",
        overallScoreMin: 55, overallScoreMax: 70,
      },
      reasoning: {
        activeRuleIds: ["berkendara_berbahaya", "dingin_kabut"],
        adjustedScoreMin: 85, adjustedSentiment: "waspada",
      },
      highlights: { warningCount: 3, positiveCount: 3 },
      nlg: {
        narrativeHints: ["kabut", "dingin", "pandang"],
        keyPhraseHints: ["Berkendara", "Dingin", "Kabut"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-005",
    label: "Hujan deras -- banjir risiko",
    input: {
      tempC: 26, tempF: 79, feelslikeC: 27, feelslikeF: 81,
      humidity: 88, weatherPrimary: "Heavy Rain",
      windSpeedKPH: 25, windSpeedMPH: 16, windDir: "SE", windDirDEG: 135, windGustKPH: 40,
      uvi: 1, visibilityKM: 6, pop: 90, sky: 100,
      place: { name: "Bogor", state: "Jawa Barat", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "sangat_lembap", wind_label: "angin_ringan",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_sedang",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 3, netral: 2, waspada: 2, berbahaya: 1 }, // FIX: N 1→2
        overallSentiment: "berbahaya",
        overallScoreMin: 52, overallScoreMax: 54,
      },
      reasoning: {
        activeRuleIds: ["banjir_bandang_risiko"],
        adjustedScoreMin: 85, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 3, positiveCount: 3 },
      nlg: {
        narrativeHints: ["hujan", "banjir", "deras"],
        keyPhraseHints: ["Banjir"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-006",
    label: "Panas ekstrem + UV ekstrem",
    input: {
      tempC: 38, tempF: 100, feelslikeC: 40, feelslikeF: 104,
      humidity: 35, weatherPrimary: "Sunny",
      windSpeedKPH: 10, windSpeedMPH: 6, windDir: "E", windDirDEG: 90, windGustKPH: 15,
      uvi: 11, visibilityKM: 25, pop: 0, sky: 5,
      place: { name: "Semarang", state: "Jawa Tengah", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "sangat_panas", humidity_label: "kering", wind_label: "sepoi_sepoi",
        uv_label: "uv_ekstrem", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 4, netral: 2, waspada: 0, berbahaya: 2 }, // FIX: N 1→2
        overallSentiment: "berbahaya",
        overallScoreMin: 60, overallScoreMax: 75,
      },
      reasoning: {
        activeRuleIds: ["heat_stroke_risiko", "sunburn_risiko", "uv_ekstrem_cerah"],
        adjustedScoreMin: 90, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 2, positiveCount: 4 },
      nlg: {
        narrativeHints: ["panas", "ekstrem", "UV", "heat"],
        keyPhraseHints: ["Heat", "Sunburn", "UV"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-007",
    label: "Sangat dingin -- waspada hipotermia",
    input: {
      tempC: 3, tempF: 37, feelslikeC: -2, feelslikeF: 28,
      humidity: 70, weatherPrimary: "Snow",
      windSpeedKPH: 55, windSpeedMPH: 34, windDir: "NW", windDirDEG: 315, windGustKPH: 50,
      uvi: 0, visibilityKM: 8, pop: 80, sky: 95,
      place: { name: "Sapporo", state: "Hokkaido", country: "Japan" },
    },
    expected: {
      tokens: {
        temp_label: "sangat_dingin", humidity_label: "lembap", wind_label: "angin_kencang",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_sedang",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 1, netral: 3, waspada: 3, berbahaya: 1 }, // sangat_dingin → berbahaya
        overallSentiment: "berbahaya",
        overallScoreMin: 35, overallScoreMax: 45,
      },
      reasoning: {
        activeRuleIds: ["hujan_badai", "kondisi_beku", "wind_chill_ekstrem"],
        adjustedScoreMin: 85, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 4, positiveCount: 1 },
      nlg: {
        narrativeHints: ["dingin", "beku", "badai", "salju"],
        keyPhraseHints: ["Badai", "Beku"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-008",
    label: "Hujan ringan -- peluang hujan sedang",
    input: {
      tempC: 29, tempF: 84, feelslikeC: 30, feelslikeF: 86,
      humidity: 65, weatherPrimary: "Light Rain",
      windSpeedKPH: 18, windSpeedMPH: 11, windDir: "SW", windDirDEG: 225, windGustKPH: 25,
      uvi: 4, visibilityKM: 10, pop: 55, sky: 85,
      place: { name: "Yogyakarta", state: "DIY", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "lembap", wind_label: "angin_ringan",
        uv_label: "uv_sedang", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 3, netral: 4, waspada: 1, berbahaya: 0 }, // FIX: N 3→4
        overallSentiment: "cukup",
        overallScoreMin: 60, overallScoreMax: 75,
      },
      reasoning: {
        activeRuleIds: [],
        adjustedScoreMin: 80, adjustedSentiment: "baik",
      },
      highlights: { warningCount: 1, positiveCount: 3 },
      nlg: {
        narrativeHints: ["hujan", "ringan"],
        keyPhraseHints: ["Hujan", "Ringan"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-009",
    label: "Kering + UV tinggi -- kulit risiko",
    input: {
      tempC: 32, tempF: 90, feelslikeC: 33, feelslikeF: 91,
      humidity: 18, weatherPrimary: "Sunny",
      windSpeedKPH: 12, windSpeedMPH: 7, windDir: "NNE", windDirDEG: 22.5, windGustKPH: 18,
      uvi: 9, visibilityKM: 30, pop: 0, sky: 0,
      place: { name: "Kupang", state: "NTT", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "panas", humidity_label: "sangat_kering", wind_label: "angin_ringan",
        uv_label: "uv_sangat_tinggi", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 4, netral: 1, waspada: 2, berbahaya: 1 }, // sangat_kering → berbahaya
        overallSentiment: "berbahaya",
        overallScoreMin: 55, overallScoreMax: 70,
      },
      reasoning: {
        activeRuleIds: ["kulit_rusak_cepat", "sunburn_risiko"],
        adjustedScoreMin: 88, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 3, positiveCount: 4 },
      nlg: {
        narrativeHints: ["kering", "panas", "UV", "kulit"],
        keyPhraseHints: ["Kulit", "Sunburn"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-010",
    label: "Angin kencang -- waspada pohon tumbang",
    input: {
      tempC: 27, tempF: 81, feelslikeC: 28, feelslikeF: 82,
      humidity: 55, weatherPrimary: "Cloudy",
      windSpeedKPH: 55, windSpeedMPH: 34, windDir: "WSW", windDirDEG: 247.5, windGustKPH: 75,
      uvi: 2, visibilityKM: 12, pop: 5, sky: 80,
      place: { name: "Makassar", state: "Sulawesi Selatan", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "normal", wind_label: "angin_kencang",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 4, netral: 3, waspada: 1, berbahaya: 0 }, // FIX: N 2→3
        overallSentiment: "cukup",
        overallScoreMin: 70, overallScoreMax: 85,
      },
      reasoning: {
        activeRuleIds: [],
        adjustedScoreMin: 85, adjustedSentiment: "cukup",
      },
      highlights: { warningCount: 1, positiveCount: 4 },
      nlg: {
        narrativeHints: ["angin", "kencang"],
        keyPhraseHints: ["Angin", "Kencang"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-011",
    label: "Nol peluang hujan -- cerah total",
    input: {
      tempC: 30, tempF: 86, feelslikeC: 31, feelslikeF: 88,
      humidity: 45, weatherPrimary: "Clear",
      windSpeedKPH: 6, windSpeedMPH: 4, windDir: "ENE", windDirDEG: 67.5, windGustKPH: 10,
      uvi: 6, visibilityKM: 30, pop: 0, sky: 0,
      place: { name: "Denpasar", state: "Bali", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "normal", wind_label: "tenang",
        uv_label: "uv_tinggi", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 6, netral: 1, waspada: 1, berbahaya: 0 }, // FIX: N 0→1
        overallSentiment: "baik",
        overallScoreMin: 80, overallScoreMax: 95,
      },
      reasoning: {
        activeRuleIds: ["cerah_nyaman", "cuaca_ideal"],
        adjustedScoreMin: 95, adjustedSentiment: "baik",
      },
      highlights: { warningCount: 1, positiveCount: 6 },
      nlg: {
        narrativeHints: ["cerah", "hangat", "UV"],
        keyPhraseHints: ["Cerah", "Nyaman", "Ideal"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-012",
    label: "Hujan badai -- kondisi darurat",
    input: {
      tempC: 25, tempF: 77, feelslikeC: 26, feelslikeF: 79,
      humidity: 92, weatherPrimary: "Thunderstorm",
      windSpeedKPH: 65, windSpeedMPH: 40, windDir: "NNW", windDirDEG: 337.5, windGustKPH: 90,
      uvi: 0, visibilityKM: 2, pop: 98, sky: 100,
      place: { name: "Aceh", state: "Aceh", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "sangat_lembap", wind_label: "angin_kencang",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_buruk",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 2, netral: 1, waspada: 4, berbahaya: 1 }, // FIX: N 0→1
        overallSentiment: "berbahaya",
        overallScoreMin: 30, overallScoreMax: 45,
      },
      reasoning: {
        activeRuleIds: ["badai_petir_berbahaya", "hujan_badai", "kecelakaan_risiko"],
        adjustedScoreMin: 85, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 5, positiveCount: 2 },
      nlg: {
        narrativeHints: ["badai", "petir", "hujan"],
        keyPhraseHints: ["Badai", "Petir"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-013",
    label: "Suhu sejuk -- angin tenang -- ideal bersepeda",
    input: {
      tempC: 22, tempF: 72, feelslikeC: 21, feelslikeF: 70,
      humidity: 55, weatherPrimary: "Mostly Sunny",
      windSpeedKPH: 3, windSpeedMPH: 2, windDir: "ESE", windDirDEG: 112.5, windGustKPH: 5,
      uvi: 5, visibilityKM: 25, pop: 0, sky: 25,
      place: { name: "Medan", state: "Sumatera Utara", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "sejuk", humidity_label: "normal", wind_label: "tenang",
        uv_label: "uv_sedang", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 6, netral: 2, waspada: 0, berbahaya: 0 }, // FIX: N 1→2
        overallSentiment: "baik",
        overallScoreMin: 90, overallScoreMax: 100,
      },
      reasoning: {
        activeRuleIds: ["cerah_nyaman", "cuaca_ideal"],
        adjustedScoreMin: 95, adjustedSentiment: "baik",
      },
      highlights: { warningCount: 0, positiveCount: 6 },
      nlg: {
        narrativeHints: ["cerah", "ringan", "nyaman"],
        keyPhraseHints: ["Cerah", "Nyaman", "Ideal"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-014",
    label: "Kabut asap -- kualitas udara buruk",
    input: {
      tempC: 28, tempF: 82, feelslikeC: 29, feelslikeF: 84,
      humidity: 60, weatherPrimary: "Haze",
      windSpeedKPH: 8, windSpeedMPH: 5, windDir: "WNW", windDirDEG: 292.5, windGustKPH: 12,
      uvi: 3, visibilityKM: 2.5, pop: 0, sky: 70,
      place: { name: "Palembang", state: "Sumatera Selatan", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "lembap", wind_label: "sepoi_sepoi",
        uv_label: "uv_sedang", visibility_label: "jarak_pandang_buruk",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 3, netral: 3, waspada: 2, berbahaya: 0 }, // FIX: N 2→3
        overallSentiment: "cukup",
        overallScoreMin: 60, overallScoreMax: 66,
      },
      reasoning: {
        activeRuleIds: ["berkendara_berbahaya"],
        adjustedScoreMin: 85, adjustedSentiment: "cukup",
      },
      highlights: { warningCount: 2, positiveCount: 3 },
      nlg: {
        narrativeHints: ["kabut", "pandang", "asap"],
        keyPhraseHints: ["Berkendara"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-015",
    label: "Gerimis -- lembap ringan",
    input: {
      tempC: 26, tempF: 79, feelslikeC: 27, feelslikeF: 81,
      humidity: 72, weatherPrimary: "Drizzle",
      windSpeedKPH: 10, windSpeedMPH: 6, windDir: "SSE", windDirDEG: 157.5, windGustKPH: 15,
      uvi: 2, visibilityKM: 8, pop: 40, sky: 90,
      place: { name: "Padang", state: "Sumatera Barat", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "lembap", wind_label: "sepoi_sepoi",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_sedang",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 3, netral: 5, waspada: 0, berbahaya: 0 }, // FIX: N 4→5
        overallSentiment: "cukup",
        overallScoreMin: 60, overallScoreMax: 75,
      },
      reasoning: {
        activeRuleIds: [],
        adjustedScoreMin: 80, adjustedSentiment: "baik",
      },
      highlights: { warningCount: 0, positiveCount: 3 },
      nlg: {
        narrativeHints: ["gerimis", "ringan"],
        keyPhraseHints: ["Gerimis", "Lembap"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-016",
    label: "Sangat panas + sangat lembap -- heat stress",
    input: {
      tempC: 37, tempF: 99, feelslikeC: 42, feelslikeF: 108,
      humidity: 85, weatherPrimary: "Mostly Cloudy",
      windSpeedKPH: 12, windSpeedMPH: 7, windDir: "SSW", windDirDEG: 202.5, windGustKPH: 18,
      uvi: 6, visibilityKM: 12, pop: 15, sky: 75,
      place: { name: "Jakarta", state: "DKI Jakarta", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "sangat_panas", humidity_label: "sangat_lembap", wind_label: "angin_ringan",
        uv_label: "uv_tinggi", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 2, netral: 3, waspada: 2, berbahaya: 1 }, // FIX: N 2→3
        overallSentiment: "berbahaya",
        overallScoreMin: 45, overallScoreMax: 60,
      },
      reasoning: {
        activeRuleIds: ["heat_stress_berat"],
        adjustedScoreMin: 88, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 3, positiveCount: 2 },
      nlg: {
        narrativeHints: ["panas", "lembap", "heat", "UV"],
        keyPhraseHints: ["Heat"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-017",
    label: "Sangat kering -- potensi kebakaran",
    input: {
      tempC: 33, tempF: 91, feelslikeC: 34, feelslikeF: 93,
      humidity: 12, weatherPrimary: "Sunny",
      windSpeedKPH: 22, windSpeedMPH: 14, windDir: "SE", windDirDEG: 135, windGustKPH: 30,
      uvi: 10, visibilityKM: 30, pop: 0, sky: 0,
      place: { name: "Mataram", state: "NTB", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "panas", humidity_label: "sangat_kering", wind_label: "angin_ringan",
        uv_label: "uv_sangat_tinggi", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 4, netral: 1, waspada: 2, berbahaya: 1 }, // sangat_kering → berbahaya
        overallSentiment: "berbahaya",
        overallScoreMin: 55, overallScoreMax: 70,
      },
      reasoning: {
        activeRuleIds: ["kulit_rusak_cepat", "sunburn_risiko"],
        adjustedScoreMin: 88, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 3, positiveCount: 4 },
      nlg: {
        narrativeHints: ["kering", "panas", "kebakaran", "UV"],
        keyPhraseHints: ["Kulit", "Sunburn"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-018",
    label: "Angin sedang + hujan ringan",
    input: {
      tempC: 27, tempF: 81, feelslikeC: 28, feelslikeF: 82,
      humidity: 68, weatherPrimary: "Light Rain",
      windSpeedKPH: 30, windSpeedMPH: 19, windDir: "S", windDirDEG: 180, windGustKPH: 42,
      uvi: 3, visibilityKM: 10, pop: 55, sky: 85,
      place: { name: "Manado", state: "Sulawesi Utara", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "lembap", wind_label: "angin_sedang",
        uv_label: "uv_sedang", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 2, netral: 5, waspada: 1, berbahaya: 0 }, // FIX: N 4→5
        overallSentiment: "cukup",
        overallScoreMin: 60, overallScoreMax: 67,
      },
      reasoning: {
        activeRuleIds: ["angin_hujan_sedang"],
        adjustedScoreMin: 88, adjustedSentiment: "baik",
      },
      highlights: { warningCount: 1, positiveCount: 2 },
      nlg: {
        narrativeHints: ["angin", "hujan", "sedang"],
        keyPhraseHints: ["Angin", "Hujan"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-019",
    label: "Banjir lokal -- lembap + hujan",
    input: {
      tempC: 25, tempF: 77, feelslikeC: 26, feelslikeF: 79,
      humidity: 82, weatherPrimary: "Rain",
      windSpeedKPH: 20, windSpeedMPH: 12, windDir: "WSW", windDirDEG: 247.5, windGustKPH: 28,
      uvi: 1, visibilityKM: 6, pop: 75, sky: 95,
      place: { name: "Tangerang", state: "Banten", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "sangat_lembap", wind_label: "angin_ringan",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_sedang",
      },
      stemmed: {
        conceptCount: 8,                                          // FIX: 7→8
        sentiments: { positif: 3, netral: 2, waspada: 3, berbahaya: 0 }, // FIX: N 1→2
        overallSentiment: "waspada",
        overallScoreMin: 50, overallScoreMax: 65,
      },
      reasoning: {
        activeRuleIds: ["banjir_lokal_waspada"],
        adjustedScoreMin: 82, adjustedSentiment: "waspada",
      },
      highlights: { warningCount: 3, positiveCount: 3 },
      nlg: {
        narrativeHints: ["lembap", "hujan", "banjir"],
        keyPhraseHints: ["Banjir"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-020",
    label: "Semua parameter di batas ekstrem -- ujung boundary",
    input: {
      tempC: 10, tempF: 50, feelslikeC: 8, feelslikeF: 46,
      humidity: 20, weatherPrimary: "Overcast",
      windSpeedKPH: 2, windSpeedMPH: 1, windDir: "N", windDirDEG: 0, windGustKPH: 3,
      uvi: 2, visibilityKM: 10, pop: 20, sky: 100,
      place: { name: "Puncak", state: "Jawa Barat", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "sangat_dingin", humidity_label: "kering", wind_label: "sepoi_sepoi",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,
        sentiments: { positif: 3, netral: 4, waspada: 0, berbahaya: 1 }, // sangat_dingin → berbahaya
        overallSentiment: "berbahaya",
        overallScoreMin: 55, overallScoreMax: 70,
      },
      reasoning: {
        activeRuleIds: [],
        adjustedScoreMin: 80, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 1, positiveCount: 3 },
      nlg: {
        narrativeHints: ["dingin", "angin"],
        keyPhraseHints: ["Dingin", "Kering"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-021",
    label: "Sangat dingin ekstrem -- suhu 0°C",
    input: {
      tempC: 0, tempF: 32, feelslikeC: -5, feelslikeF: 23,
      humidity: 60, weatherPrimary: "Overcast",
      windSpeedKPH: 10, windSpeedMPH: 6, windDir: "N", windDirDEG: 0, windGustKPH: 15,
      uvi: 0, visibilityKM: 5, pop: 30, sky: 100,
      place: { name: "Dieng", state: "Jawa Tengah", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "sangat_dingin", humidity_label: "normal", wind_label: "sepoi_sepoi",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_sedang",
      },
      stemmed: {
        conceptCount: 8,
        sentiments: { positif: 2, netral: 5, waspada: 0, berbahaya: 1 },
        overallSentiment: "berbahaya",
        overallScoreMin: 55, overallScoreMax: 65,
      },
      reasoning: {
        activeRuleIds: [],
        adjustedScoreMin: 74, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 1, positiveCount: 3 },
      nlg: {
        narrativeHints: ["dingin", "angin"],
        keyPhraseHints: ["Dingin", "Beku"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-022",
    label: "Sangat panas ekstrem -- suhu 40°C",
    input: {
      tempC: 40, tempF: 104, feelslikeC: 44, feelslikeF: 111,
      humidity: 25, weatherPrimary: "Sunny",
      windSpeedKPH: 8, windSpeedMPH: 5, windDir: "E", windDirDEG: 90, windGustKPH: 12,
      uvi: 11, visibilityKM: 30, pop: 0, sky: 0,
      place: { name: "Surakarta", state: "Jawa Tengah", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "sangat_panas", humidity_label: "kering", wind_label: "sepoi_sepoi",
        uv_label: "uv_ekstrem", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,
        sentiments: { positif: 4, netral: 2, waspada: 0, berbahaya: 2 },
        overallSentiment: "berbahaya",
        overallScoreMin: 55, overallScoreMax: 70,
      },
      reasoning: {
        activeRuleIds: ["heat_stroke_risiko", "sunburn_risiko", "uv_ekstrem_cerah"],
        adjustedScoreMin: 88, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 2, positiveCount: 4 },
      nlg: {
        narrativeHints: ["panas", "ekstrem", "UV", "heat"],
        keyPhraseHints: ["Heat", "Sunburn", "UV"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-023",
    label: "Badai angin 100km/h -- tanpa hujan",
    input: {
      tempC: 28, tempF: 82, feelslikeC: 29, feelslikeF: 84,
      humidity: 50, weatherPrimary: "Partly Cloudy",
      windSpeedKPH: 100, windSpeedMPH: 62, windDir: "W", windDirDEG: 270, windGustKPH: 130,
      uvi: 2, visibilityKM: 10, pop: 5, sky: 60,
      place: { name: "Anyer", state: "Banten", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "normal", wind_label: "badai",
        uv_label: "uv_rendah", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,
        sentiments: { positif: 5, netral: 2, waspada: 0, berbahaya: 1 },
        overallSentiment: "berbahaya",
        overallScoreMin: 70, overallScoreMax: 85,
      },
      reasoning: {
        activeRuleIds: [],
        adjustedScoreMin: 85, adjustedSentiment: "berbahaya",
      },
      highlights: { warningCount: 1, positiveCount: 5 },
      nlg: {
        narrativeHints: ["angin"],
        keyPhraseHints: ["Badai"],
        adviceCount: 8,
      },
    },
  },
  {
    id: "case-024",
    label: "Normal typical day -- hangat dan berawan",
    input: {
      tempC: 25, tempF: 77, feelslikeC: 25, feelslikeF: 77,
      humidity: 55, weatherPrimary: "Mostly Cloudy",
      windSpeedKPH: 12, windSpeedMPH: 7, windDir: "NNE", windDirDEG: 22.5, windGustKPH: 18,
      uvi: 4, visibilityKM: 20, pop: 10, sky: 65,
      place: { name: "Bandung", state: "Jawa Barat", country: "Indonesia" },
    },
    expected: {
      tokens: {
        temp_label: "hangat", humidity_label: "normal", wind_label: "sepoi_sepoi",
        uv_label: "uv_sedang", visibility_label: "jarak_pandang_baik",
      },
      stemmed: {
        conceptCount: 8,
        sentiments: { positif: 4, netral: 4, waspada: 0, berbahaya: 0 },
        overallSentiment: "baik",
        overallScoreMin: 70, overallScoreMax: 90,
      },
      reasoning: {
        activeRuleIds: ["cuaca_ideal"],
        adjustedScoreMin: 80, adjustedSentiment: "baik",
      },
      highlights: { warningCount: 0, positiveCount: 4 },
      nlg: {
        narrativeHints: ["nyaman", "angin"],
        keyPhraseHints: ["Hangat", "Cuaca", "Nyaman"],
        adviceCount: 8,
      },
    },
  },
];