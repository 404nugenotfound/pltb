"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Wind,
  BarChart3,
  Clock,
  Zap,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Compass,
  Thermometer,
  Droplets,
  TrendingUp,
  Newspaper,
  X,
  ArrowLeft,
  Settings,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  ShieldX,
  Navigation,
} from "lucide-react";

import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import type { StemmedWeather } from "@/lib/nlp/stemming";

// Leaflet SSR-safe
const MapComponent = dynamic(
  () => import("../components/dashboard/MapComponent"),
  { ssr: false },
);

// ─── Types ──────────────────────────────────────────────────────────────

interface DailyData {
  time: string[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weathercode: number[];
  weatherPrimary: string[];
}

interface HourlyData {
  time: string[];
  temperature_2m: number[];
  relativehumidity_2m: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
}

interface NewsItem {
  title: string;
  content: string;
  xweather?: string;
}

interface ModalData {
  date: string;
  dateISO: string;
  windSpeed: number;
  windKmh: number;
  weatherCond: string;
  temp: number;
  energy: number;
}

// ─── NEW: Tipe output NLP dari /api/analytics/nlp ──────────────────────

interface NlpSentimentBreakdown {
  positif: number;
  netral: number;
  waspada: number;
  berbahaya: number;
}

interface NlpSentiment {
  label: "baik" | "cukup" | "waspada" | "berbahaya";
  score: number;
  tone: string;
  breakdown: NlpSentimentBreakdown;
}

interface NlpHighlights {
  warnings: string[];
  positives: string[];
}

interface NlpConcept {
  concept: string;
  sentiment: "positif" | "netral" | "waspada" | "berbahaya";
  humanLabel: string;
  advice: string;
  weight: number;
}

interface NlpOutput {
  summary: string;
  sentiment: NlpSentiment;
  advice: string[];
  highlights: NlpHighlights;
}

type ValCheckRes = { name: string; status: "passed" | "warning" | "failed"; message: string };
type StageValidationRes = { stage: string; status: "passed" | "warning" | "failed"; checks: ValCheckRes[] };
type AccCheckRes = { name: string; status: "passed" | "warning" | "failed"; score: number; message: string; detail?: string };
type StageAccuracyRes = { stage: string; score: number; checks: AccCheckRes[] };

interface NlpPipelineResponse {
  success: boolean;
  location: string;
  pipeline: {
    step2_tokens: string[];
    step3_stemmed: {
      concepts: StemmedWeather["concepts"];
      overallSentiment: StemmedWeather["overallSentiment"];
      overallScore: number;
    };
    step4_nlp: NlpOutput;
    step5_xai: {
      tokenizing: {
        classifications: Array<{ parameter: string; rawValue: string | number; unit: string; label: string; category: string }>;
      };
      stemming: {
        concepts: Array<{ concept: string; humanLabel: string; sentiment: string; baseWeight: number; finalWeight: number; boostAmount: number; boostSources: string[] }>;
      };
      features: {
        ngramBoosts: Array<{ ngram: string; baseScore: number; boost: number; finalScore: number; boostReason: string }>;
        tfidfHighlights: Array<{ term: string; tfidf: number; significance: string }>;
      };
      reasoning: {
        activeRules: Array<{ ruleId: string; label: string; matchedConditions: string[]; severity: number; impactDescription: string; advice: string }>;
        totalRules: number;
      };
      sentiment: {
        breakdownDetail: Array<{ category: string; count: number; percentage: number; concepts: string[] }>;
        scoreExplanation: string;
        labelExplanation: string;
      };
      highlights: {
        warnings: Array<{ text: string; reason: string; sourceConcept: string }>;
        positives: Array<{ text: string; reason: string; sourceConcept: string }>;
      };
    };
    validation: {
      tokenizing: StageValidationRes;
      stemming: StageValidationRes;
      features: StageValidationRes;
      reasoning: StageValidationRes;
      nlg: StageValidationRes;
      sentiment: StageValidationRes;
      highlights: StageValidationRes;
    };
    accuracy: {
      tokenizing: StageAccuracyRes;
      stemming: StageAccuracyRes;
      features: StageAccuracyRes;
      reasoning: StageAccuracyRes;
      nlg: StageAccuracyRes;
      sentiment: StageAccuracyRes;
      highlights: StageAccuracyRes;
    };
  };
  testAccuracy?: {
    passed: number;
    total: number;
    score: number;
  };
  error?: string;
}

type ActiveView = "daily" | "trends";
type TrendFilter = "hourly" | "dailyAgg";

// ─── Utilities ──────────────────────────────────────────────────────────

function degToCardinal(deg: number): string {
  const dirs = [
    "Utara",
    "Timur Laut",
    "Timur",
    "Tenggara",
    "Selatan",
    "Barat Daya",
    "Barat",
    "Barat Laut",
  ];
  return dirs[Math.round(deg / 45) % 8];
}

function xweatherIconToCode(icon: string): number {
  const name = (icon || "").replace(".png", "").toLowerCase();
  const map: Record<string, number> = {
    clear: 0,
    mclear: 1,
    pcloudy: 2,
    mcloudy: 3,
    cloudy: 3,
    fog: 45,
    hazy: 48,
    smoke: 48,
    dust: 48,
    drizzle: 51,
    rain: 61,
    rain_showers: 80,
    tstorms: 95,
    tstorms_rain: 95,
    snow: 71,
    flurries: 71,
    hail: 96,
    ice: 96,
  };
  return map[name] ?? 0;
}

function translateWeatherPrimary(raw: string): string {
  if (!raw) return "";
  const map: Record<string, string> = {
    sunny: "☀️ Cerah",
    clear: "☀️ Cerah",
    "mostly sunny": "🌤 Sebagian Besar Cerah",
    "mostly clear": "🌤 Sebagian Besar Cerah",
    "partly cloudy": "⛅ Sebagian Berawan",
    "partly sunny": "⛅ Sebagian Cerah",
    "mostly cloudy": "🌥 Sebagian Besar Mendung",
    cloudy: "☁️ Mendung",
    overcast: "☁️ Mendung Tebal",
    fog: "🌫 Kabut",
    haze: "🌫 Kabut Tipis",
    smoke: "🌫 Asap",
    dust: "🌫 Berdebu",
    drizzle: "🌦 Gerimis",
    "light drizzle": "🌦 Gerimis Ringan",
    rain: "🌧 Hujan",
    "light rain": "🌧 Hujan Ringan",
    "moderate rain": "🌧 Hujan Sedang",
    "heavy rain": "🌧 Hujan Lebat",
    showers: "🌦 Hujan Singkat",
    "rain showers": "🌦 Hujan Singkat",
    "light showers": "🌦 Hujan Singkat Ringan",
    "heavy showers": "🌦 Hujan Singkat Lebat",
    "scattered showers": "🌦 Hujan Tersebar",
    "isolated showers": "🌦 Hujan Lokal",
    "chance of showers": "🌦 Kemungkinan Hujan",
    "chance of rain": "🌧 Kemungkinan Hujan",
    thunderstorm: "⛈ Badai Petir",
    thunderstorms: "⛈ Badai Petir",
    tstorm: "⛈ Badai Petir",
    thundershowers: "⛈ Hujan Petir",
    "isolated thunderstorms": "⛈ Badai Petir Lokal",
    "scattered thunderstorms": "⛈ Badai Petir Tersebar",
    "chance of thunderstorms": "⛈ Kemungkinan Badai Petir",
    snow: "❄️ Salju",
    "light snow": "❄️ Salju Ringan",
    "heavy snow": "❄️ Salju Lebat",
    flurries: "❄️ Hujan Salju Ringan",
    "snow showers": "❄️ Hujan Salju",
    sleet: "🌨 Hujan Es",
    hail: "🌨 Hujan Es Besar",
    "freezing rain": "🌨 Hujan Beku",
    ice: "🧊 Es",
    windy: "💨 Berangin",
    breezy: "💨 Berangin Sepoi",
  };
  const key = raw.toLowerCase().trim();
  if (map[key]) return map[key];
  for (const [eng, id] of Object.entries(map)) {
    if (key.includes(eng)) return id;
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function energyPotential(speed: number): number {
  return Math.max(10, Math.min(100, Math.round((speed / 14.2) * 100)));
}

function getWeatherLabel(code: number): string {
  if (code === 0) return "☀️ Cerah";
  if (code === 1) return "🌤 Sebagian Cerah";
  if (code === 2) return "⛅ Berawan";
  if (code === 3) return "☁ Mendung";
  if (code === 45 || code === 48) return "🌫 Kabut";
  if (code >= 51 && code <= 55) return "🌦 Gerimis";
  if (code >= 61 && code <= 65) return "🌧 Hujan";
  if (code >= 71 && code <= 75) return "❄️ Salju";
  if (code >= 80 && code <= 82) return "🌦 Hujan petir";
  if (code >= 95) return "⛈ Badai petir";
  return "🌥 Berawan";
}

function getDayLabel(i: number): string {
  if (i === 0) return "Hari ini";
  if (i === 1) return "Besok";
  if (i === 2) return "Lusa";
  return `+${i} hari`;
}

function generateNews(
  location: string,
  avgSpeed: string,
  dir: string,
): NewsItem[] {
  return [
    {
      title: `🌬 Potensi angin hijau di ${location}`,
      content: `Berdasarkan model prediksi Ventara, kecepatan angin rata-rata di wilayah ${location} mencapai ${avgSpeed} m/s dalam 7 hari ke depan. Kondisi ini sangat prospektif untuk pembangkit listrik tenaga bayu, dengan estimasi peningkatan efisiensi turbin hingga +23%. Arah angin dominan ${dir} memberikan stabilitas optimal untuk blade.`,
    },
    {
      title: `⚡ Inovasi penyimpanan & grid cerdas`,
      content: `Sistem baterai hibrida mulai diimplementasikan di kawasan pesisir timur, termasuk area ${location}. Kombinasi prakiraan angin yang kuat memungkinkan pemanfaatan malam hari lebih stabil, penyimpanan energi meningkat 17% lebih efisien berkolaborasi dengan ramalan Ventara.`,
    },
    {
      title: `📈 Outlook energi bersih: ${location} unggulan`,
      content: `Analisis satelit dan machine learning menunjukkan pola hembusan angin yang konsisten di ${location}. Potensi pembangkit hybrid angin + surya diperkirakan naik 28% pada musim timur tahun ini. Ventara merekomendasikan optimalisasi turbin dengan pitch control adaptif.`,
    },
  ];
}

// ─── API ────────────────────────────────────────────────────────────────

async function fetchDaily(lat: number, lng: number): Promise<DailyData> {
  const res = await fetch(`/api/xweather-daily?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error("Gagal mengambil data harian.");
  const data = await res.json();
  if (!data.success)
    throw new Error(data.error?.description || "Gagal mengambil data harian.");

  const daily: DailyData = {
    time: [],
    wind_speed_10m_max: [],
    wind_direction_10m_dominant: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    weathercode: [],
    weatherPrimary: [],
  };

  const periods = data.response?.[0]?.periods;
  if(periods) {
    periods.forEach((p: {
      dateTimeISO: string; maxTempC: number; minTempC: number;
      windDirDEG: number; windSpeedMaxMPS: number; icon: string; weatherPrimary: string;
    }) => {
      daily.time.push(p.dateTimeISO.split("T")[0]);
      daily.temperature_2m_max.push(p.maxTempC ?? 0);
      daily.temperature_2m_min.push(p.minTempC ?? 0);
      daily.wind_speed_10m_max.push(parseFloat(((p.windSpeedMaxMPS ?? 0) * 3.6).toFixed(1)));
      daily.wind_direction_10m_dominant.push(p.windDirDEG ?? 0);
      daily.weathercode.push(xweatherIconToCode(p.icon));
      daily.weatherPrimary.push(translateWeatherPrimary(p.weatherPrimary ?? ""));
    });
  }

  return daily;
}

async function fetchHourly(lat: number, lng: number): Promise<HourlyData> {
  const res = await fetch(`/api/xweather-hourly?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error("Gagal mengambil data per jam.");
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.description || "Gagal mengambil data per jam.");

  const hourly: HourlyData = {
    time: [], temperature_2m: [], relativehumidity_2m: [],
    wind_speed_10m: [], wind_direction_10m: [],
  };

  const periods = data.response?.[0]?.periods;
  if (periods) {
    periods.forEach((p: {
      dateTimeISO: string; tempC: number; humidity: number;
      windSpeedKPH: number; windDirDEG: number;
    }) => {
      hourly.time.push(p.dateTimeISO);
      hourly.temperature_2m.push(p.tempC ?? 0);
      hourly.relativehumidity_2m.push(p.humidity ?? 0);
      hourly.wind_speed_10m.push(parseFloat((p.windSpeedKPH ?? 0).toFixed(1)));
      hourly.wind_direction_10m.push(p.windDirDEG ?? 0);
    });
  }
  return hourly;
}

async function searchLocationAPI(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Ventara-Dashboard/2.0" },
  });
  const data = await res.json();
  if (!data.length) throw new Error("Lokasi tidak ditemukan.");
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name.split(",")[0],
  };
}

async function searchLocationSuggestions(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string }[]> {
  if (!query.trim() || query.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Ventara-Dashboard/2.0" },
  });
  const data = await res.json();
  return data.map(
    (item: { lat: string; lon: string; display_name: string }) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name.split(",")[0],
    }),
  );
}

// ─── NEW: Ganti fetchXWeatherPhrase → fetchNlpAnalysis ──────────────────
// Memanggil /api/analytics/nlp yang sudah kita buat.
// Tidak ada lagi panggilan ke phrases.api.xweather.com maupun
// pembuatan kalimat manual dari forecast data.

async function fetchNlpAnalysis(
  lat: number,
  lng: number,
  modalData: ModalData,
): Promise<NlpPipelineResponse> {
  const res = await fetch("/api/analytics/nlp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: `${lat},${lng}`,
      dateISO: modalData.dateISO,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `NLP API error: ${res.status}`);
  }

  const data: NlpPipelineResponse = await res.json();
  if (!data.success) throw new Error(data.error || "NLP gagal diproses.");
  return data;
}

// ─── Sidebar ────────────────────────────────────────────────────────────

// const navItems = [
//   { icon: Sparkles,  label: "Welcome",     href: "/dashboard" },
//   { icon: BarChart3, label: "Analytics",   href: "/dashboard/analytics", active: true },
//   { icon: Clock,     label: "Realtime",    href: "/dashboard/realtime" },
//   { icon: Zap,       label: "Forecasting", href: "/dashboard/forcesting" },
// ]

// function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
//   return (
//     <aside className={`fixed left-0 top-0 z-30 h-screen bg-white border-r border-slate-200 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
//       <div className="flex h-full flex-col">
//         <div className={`flex h-16 items-center border-b border-slate-200 px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
//           {!collapsed
//             ? <div className="flex items-center gap-2">
//                 <div className="p-1.5 rounded-lg bg-orange-500/10"><Wind className="h-5 w-5 text-orange-600" /></div>
//                 <span className="font-semibold text-slate-800">Ventara</span>
//               </div>
//             : <div className="p-1.5 rounded-lg bg-orange-500/10"><Wind className="h-5 w-5 text-orange-600" /></div>}
//         </div>
//         <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
//           {navItems.map((item) => (
//             <Link key={item.label} href={item.href}
//               className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
//                 ${item.active ? "bg-orange-50 text-orange-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"}
//                 ${collapsed ? "justify-center" : ""}`}>
//               <item.icon className={`h-5 w-5 flex-shrink-0 ${item.active ? "text-orange-600" : "text-slate-500"}`} />
//               {!collapsed && <span>{item.label}</span>}
//             </Link>
//           ))}
//         </nav>
//         <div className="border-t border-slate-200 p-2">
//           <button onClick={onToggle}
//             className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors">
//             {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /><span>Collapse</span></>}
//           </button>
//         </div>
//       </div>
//     </aside>
//   )
// }

// ─── Header ─────────────────────────────────────────────────────────────

// function Header({ collapsed }: { collapsed: boolean }) {
//   return (
//     <header className={`fixed top-0 right-0 z-20 h-16 bg-white border-b border-slate-200 transition-all duration-300 ${collapsed ? "left-16" : "left-64"}`}>
//       <div className="flex h-full items-center justify-between px-6">
//         <div>
//           <h1 className="text-lg font-semibold text-slate-800">Analitik & Visualisasi</h1>
//           <p className="text-sm text-slate-500">Peta lokasi dan analisis data prakiraan angin</p>
//         </div>
//         <div className="flex items-center gap-2">
//           <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><HelpCircle className="h-5 w-5" /></button>
//           <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><Settings className="h-5 w-5" /></button>
//         </div>
//       </div>
//     </header>
//   )
// }

// ─── Carousel ───────────────────────────────────────────────────────────

function Carousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    const max = t.scrollWidth - t.clientWidth;
    setCanPrev(t.scrollLeft > 5);
    setCanNext(t.scrollLeft + t.clientWidth < max - 5);
  }, []);

  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    t.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    setTimeout(update, 50);
    return () => {
      t.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scroll = (dir: "left" | "right") => {
    const t = trackRef.current;
    if (!t) return;
    t.scrollBy({
      left: dir === "left" ? -(t.clientWidth * 0.85) : t.clientWidth * 0.85,
      behavior: "smooth",
    });
    setTimeout(update, 200);
  };

  return (
    <div className="relative">
      <button
        onClick={() => scroll("left")}
        disabled={!canPrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
      >
        <ChevronLeft className="h-4 w-4 text-slate-600" />
      </button>
      <div
        ref={trackRef}
        className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory gap-5 px-10 py-3"
        style={
          {
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          } as React.CSSProperties
        }
      >
        {children}
      </div>
      <button
        onClick={() => scroll("right")}
        disabled={!canNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
      >
        <ChevronRight className="h-4 w-4 text-slate-600" />
      </button>
    </div>
  );
}

// ─── Wind Card ───────────────────────────────────────────────────────────

function WindCard({
  date,
  speed,
  dir,
  index,
}: {
  date: string;
  speed: number;
  dir: number;
  index: number;
}) {
  const shortDate = new Date(date).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const gustEst = Math.round(speed + 7);
  return (
    <div className="snap-start min-w-70 md:min-w-75 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col shrink-0 hover:-translate-y-1 transition-all duration-200">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
          {shortDate}
        </span>
        <span className="text-xs font-bold text-[#00a991] bg-[#e6f6f4] px-2 py-0.5 rounded-full">
          {getDayLabel(index)}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-1 mb-3">
        <div
          className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center"
          style={{ transform: `rotate(${dir}deg)` }}
        >
          <Navigation className="h-6 w-6 text-[#00a991]" />
        </div>
        <div>
          <p className="text-xs text-slate-500">Kecepatan maks</p>
          <h3 className="text-2xl font-bold text-slate-800">
            {speed}
            <span className="text-sm font-normal text-slate-500"> km/jam</span>
          </h3>
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <Compass className="h-3 w-3 text-[#00a991]" /> Arah:{" "}
          {degToCardinal(dir)}
        </span>
        <span className="text-slate-400">💨 hembusan: {gustEst} km/jam</span>
      </div>
    </div>
  );
}

// ─── Weather Card ────────────────────────────────────────────────────────

function WeatherCard({
  date,
  tempMax,
  tempMin,
  weatherCode,
  weatherPrimary,
  windSpeed,
  index,
  onDetail,
}: {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  weatherPrimary: string;
  windSpeed: number;
  index: number;
  onDetail: (d: ModalData) => void;
}) {
  const shortDate = new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
  const weatherText = weatherPrimary || getWeatherLabel(weatherCode);
  const energy = energyPotential(windSpeed);
  const windKmh = windSpeed;

  return (
    <div className="snap-start min-w-70 md:min-w-77.5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col shrink-0 hover:-translate-y-1 transition-all duration-200">
      <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
        <span className="text-sm font-bold text-slate-700">
          {shortDate} · {getDayLabel(index)}
        </span>
        <span className="text-sm font-medium text-[#00a991] bg-[#e6f6f4] px-2 py-1 rounded-lg">
          {weatherText}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div>
          <p className="text-xs text-slate-500">Suhu (min - maks)</p>
          <p className="text-2xl font-extrabold text-slate-800">
            {tempMin}°<span className="text-slate-400">/</span>
            {tempMax}°C
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Kecepatan angin</p>
          <p className="text-xl font-bold text-[#00a991]">{windSpeed} km/jam</p>
        </div>
      </div>
      <button
        onClick={() =>
          onDetail({
            date: shortDate,
            dateISO: date,
            windSpeed,
            windKmh,
            weatherCond: weatherText,
            temp: tempMax,
            energy,
          })
        }
        className="mt-5 w-full bg-[#00a991] hover:bg-[#008774] text-white text-sm font-medium py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-2"
      >
        <Newspaper className="h-4 w-4" /> Detail & Analisis
      </button>
    </div>
  );
}

// ─── Trends Charts ───────────────────────────────────────────────────────

function TrendsView({
  hourlyData,
  filter,
  onFilterChange,
}: {
  hourlyData: HourlyData | null;
  filter: TrendFilter;
  onFilterChange: (f: TrendFilter) => void;
}) {
  const tempRef = useRef<HTMLCanvasElement>(null);
  const humidityRef = useRef<HTMLCanvasElement>(null);
  const windRef = useRef<HTMLCanvasElement>(null);
  const windDirRef = useRef<HTMLCanvasElement>(null);

  // ─── Helper: derajat → label kardinal + unicode arrow ───────────────
  function degToArrowLabel(deg: number): string {
    const d = ((deg % 360) + 360) % 360;
    if (d < 22.5 || d >= 337.5) return `↑ Utara`;
    if (d < 67.5) return `↗ Timur Laut`;
    if (d < 112.5) return `→ Timur`;
    if (d < 157.5) return `↘ Tenggara`;
    if (d < 202.5) return `↓ Selatan`;
    if (d < 247.5) return `↙ Barat Daya`;
    if (d < 292.5) return `← Barat`;
    return `↖ Barat Laut`;
  }

  useEffect(() => {
    if (!hourlyData) return;
    const render = async () => {
      const { default: ChartJS } = await import("chart.js/auto");
      [tempRef, humidityRef, windRef, windDirRef].forEach((r) => {
        if (r.current) ChartJS.getChart(r.current)?.destroy();
      });

      let labels: string[],
        temps: number[],
        humidity: number[],
        winds: number[],
        windDir: number[];

      const median = (arr: number[]): number => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      if (filter === "hourly") {
        labels = hourlyData.time
          .slice(0, 24)
          .map((t) => `${new Date(t).getHours()}:00`);
        temps = hourlyData.temperature_2m.slice(0, 24);
        humidity = hourlyData.relativehumidity_2m.slice(0, 24);
        winds = hourlyData.wind_speed_10m.slice(0, 24);
        windDir = (hourlyData.wind_direction_10m ?? []).slice(0, 24);
      } else {
        const map = new Map<
          string,
          { t: number[]; h: number[]; w: number[]; d: number[] }
        >();
        hourlyData.time.forEach((ts, i) => {
          const key = ts.split("T")[0];
          if (!map.has(key)) map.set(key, { t: [], h: [], w: [], d: [] });
          const d = map.get(key)!;
          d.t.push(hourlyData.temperature_2m[i]);
          d.h.push(hourlyData.relativehumidity_2m[i]);
          d.w.push(hourlyData.wind_speed_10m[i]);
          d.d.push((hourlyData.wind_direction_10m ?? [])[i] ?? 0);
        });
        labels = [];
        temps = [];
        humidity = [];
        winds = [];
        windDir = [];
        map.forEach((v, k) => {
          labels.push(k.slice(5));
          temps.push(Math.max(...v.t));
          humidity.push(
            parseFloat(
              (v.h.reduce((a, b) => a + b, 0) / v.h.length).toFixed(1),
            ),
          );
          winds.push(
            parseFloat(
              (v.w.reduce((a, b) => a + b, 0) / v.w.length).toFixed(1),
            ),
          );
          windDir.push(parseFloat(median(v.d).toFixed(1)));
        });
      }

      const baseOpts = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
      };

      if (tempRef.current)
        new ChartJS(tempRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Suhu (°C)",
                data: temps,
                borderColor: "#00a991",
                backgroundColor: "rgba(0,169,145,0.05)",
                tension: 0.3,
                fill: true,
                pointRadius: 3,
              },
            ],
          },
          options: baseOpts,
        });

      if (humidityRef.current)
        new ChartJS(humidityRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Kelembapan (%)",
                data: humidity,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59,130,246,0.05)",
                tension: 0.3,
                pointRadius: 3,
              },
            ],
          },
          options: baseOpts,
        });

      if (windRef.current)
        new ChartJS(windRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Angin (m/s)",
                data: winds,
                borderColor: "#f97316",
                backgroundColor: "rgba(249,115,22,0.05)",
                tension: 0.3,
                pointRadius: 3,
              },
            ],
          },
          options: baseOpts,
        });

      // ─── Wind Direction Chart (UPDATED) ────────────────────────────
      // • Sumbu Y tampil dengan label 0°–360°
      // • Arrow dihapus dari canvas — hanya muncul di tooltip hover
      // • Tooltip format: "↓ Selatan  (180°)"
      if (windDirRef.current)
        new ChartJS(windDirRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Arah Angin (°)",
                data: windDir,
                borderColor: "#10b981",
                backgroundColor: "rgba(16,185,129,0.08)",
                tension: 0.3,
                fill: true,
                pointRadius: 0,
                pointHitRadius: 12,
                borderWidth: 2.5,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items) => items[0]?.label ?? "",
                  label: (item) => {
                    const deg = item.raw as number;
                    const arrow = degToArrowLabel(deg);
                    return `  ${arrow}  (${Math.round(deg)}°)`;
                  },
                },
                displayColors: false,
                backgroundColor: "rgba(15,23,42,0.85)",
                titleColor: "#94a3b8",
                bodyColor: "#f1f5f9",
                bodyFont: { size: 13, weight: "bold" as const },
                padding: 10,
                cornerRadius: 8,
              },
            },
            scales: {
              x: { display: true },
              y: {
                display: true,
                min: 0,
                max: 360,
                ticks: {
                  stepSize: 90,
                  color: "#94a3b8",
                  font: { size: 11 },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  callback: (value: any) => `${value}°`,
                },
                grid: {
                  color: "rgba(148,163,184,0.15)",
                },
              },
            },
          },
        });
    };
    render();
  }, [hourlyData, filter]);

  const ChartCard = ({
    icon,
    title,
    canvasRef,
  }: {
    icon: React.ReactNode;
    title: string;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
  }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
        {icon}
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      <canvas ref={canvasRef} style={{ maxHeight: 260 }} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mt-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex gap-3">
          <button
            onClick={() => onFilterChange("hourly")}
            className={`px-5 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-1.5 ${filter === "hourly" ? "bg-[#00a991] text-white" : "bg-[#00a991]/10 text-[#008774] hover:bg-[#00a991] hover:text-white"}`}
          >
            <Clock className="h-4 w-4" /> Per Hari (Jam)
          </button>
          <button
            onClick={() => onFilterChange("dailyAgg")}
            className={`px-5 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-1.5 ${filter === "dailyAgg" ? "bg-[#00a991] text-white" : "bg-slate-100 text-slate-700 hover:bg-[#00a991] hover:text-white"}`}
          >
            <TrendingUp className="h-4 w-4" /> Per Minggu (Harian)
          </button>
        </div>
        <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">
          Tren prediksi 7 hari ke depan
        </span>
      </div>
      {!hourlyData ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-teal-100 border-t-[#00a991] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <ChartCard
            icon={<Thermometer className="h-5 w-5 text-[#00a991]" />}
            title={
              filter === "hourly"
                ? "Tren Suhu Maks / Per Jam (°C)"
                : "Suhu Maks Harian (°C)"
            }
            canvasRef={tempRef}
          />
          <ChartCard
            icon={<Droplets className="h-5 w-5 text-[#00a991]" />}
            title="Kelembapan Udara (%)"
            canvasRef={humidityRef}
          />
          <ChartCard
            icon={<Wind className="h-5 w-5 text-[#00a991]" />}
            title="Kecepatan Angin (km/jam)"
            canvasRef={windRef}
          />
          <ChartCard
            icon={<Compass className="h-5 w-5 text-[#8b5cf6]" />}
            title={
              filter === "hourly" ? "Arah Angin Per Jam" : "Arah Angin Harian"
            }
            canvasRef={windDirRef}
          />
          <p className="text-center text-xs text-slate-400 italic">
            *Data berdasarkan model open-meteo, diperbaharui sesuai lokasi peta
          </p>
        </>
      )}
    </div>
  );
}

// ─── NEW: NLP Sentiment Badge ─────────────────────────────────────────────
// Komponen kecil untuk menampilkan badge sentimen dengan warna sesuai kondisi.

function SentimentBadge({
  label,
  score,
}: {
  label: NlpSentiment["label"];
  score: number;
}) {
  const config = {
    baik: {
      icon: CheckCircle,
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      label: "Baik",
    },
    cukup: {
      icon: AlertCircle,
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      label: "Cukup",
    },
    waspada: {
      icon: ShieldAlert,
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      label: "Waspada",
    },
    berbahaya: {
      icon: ShieldX,
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      label: "Berbahaya",
    },
  };
  const c = config[label];
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.border} ${c.text}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label} · {score}/100
    </span>
  );
}
// ─── NEW: NLP Breakdown Bar ────────────────────────────────────────────────

function BreakdownBar({ breakdown }: { breakdown: NlpSentimentBreakdown }) {
  const bars = [
    {
      key: "positif",
      label: "Positif",
      color: "bg-emerald-400",
      value: breakdown.positif,
    },
    {
      key: "netral",
      label: "Netral",
      color: "bg-blue-400",
      value: breakdown.netral,
    },
    {
      key: "waspada",
      label: "Waspada",
      color: "bg-amber-400",
      value: breakdown.waspada,
    },
    {
      key: "berbahaya",
      label: "Berbahaya",
      color: "bg-red-400",
      value: breakdown.berbahaya,
    },
  ].filter((b) => b.value > 0);

  return (
    <div className="space-y-1.5 mt-3">
      <p className="text-xs font-medium text-slate-500 mb-2">
        Distribusi Sentimen Parameter
      </p>
      {bars.map((b) => (
        <div key={b.key} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-16 shrink-0">
            {b.label}
          </span>
          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${b.color} transition-all duration-500`}
              style={{ width: `${b.value}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-600 w-8 text-right">
            {b.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Modal (UPDATED) ──────────────────────────────────────────────
// Hanya bagian fetch dan render konten NLP yang berubah.
// Struktur modal, header, layout, tombol kembali — semua sama persis.

function DetailModal({
  data,
  news,
  locationName,
  lat,
  lng,
  onClose,
}: {
  data: ModalData | null;
  news: NewsItem[];
  locationName: string;
  lat: number | null;
  lng: number | null;
  onClose: () => void;
}) {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [nlpResult, setNlpResult] = useState<NlpPipelineResponse | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpError, setNlpError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || lat === null || lng === null) return;
    setSelectedNews(null);
    setNlpResult(null);
    setNlpError(null);
    setNlpLoading(true);

    fetchNlpAnalysis(lat, lng, data)
      .then(setNlpResult)
      .catch((e) =>
        setNlpError(
          e instanceof Error ? e.message : "Gagal memuat analisis NLP.",
        ),
      )
      .finally(() => setNlpLoading(false));
  }, [data, lat, lng]);

  if (!data) return null;

  const nlp = nlpResult?.pipeline.step4_nlp;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-5 bg-linear-to-r from-[#00a991] to-[#007f6d] text-white">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {selectedNews
              ? selectedNews.title.substring(0, 48) + "…"
              : "Insight Energi & Liputan Ventara"}
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-white/20 rounded-full p-1.5 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {!selectedNews ? (
            <>
              <div className="bg-[#e6f6f4] rounded-xl p-4 mb-5 border border-[#b8e4dd]">
                <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-600 mb-3">
                  <span>
                    📅 <strong>{data.date}</strong>
                  </span>
                  <span>🌡 {data.temp}°C</span>
                  <span>⚡ Potensi {data.energy}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-xl text-center shadow-sm">
                    <span className="block text-2xl font-bold text-slate-800">
                      {data.windSpeed} km/jam
                    </span>
                    <span className="block text-xs text-slate-400">max</span>
                    <span className="text-xs text-slate-500">
                      Kecepatan angin max
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl text-center shadow-sm">
                    <span className="block text-2xl font-bold text-[#00a991]">
                      {data.energy}%
                    </span>
                    <span className="text-xs text-slate-500">
                      Estimasi output listrik
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-3">
                  🌤 Kondisi: {data.weatherCond} · Kombinasi suhu & angin
                  mendukung produksi bersih.
                </p>
              </div>

              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#00a991]" /> Analisis Cuaca &
                Rekomendasi
              </h3>

              {nlpLoading && (
                <div className="border border-[#00a991]/30 rounded-xl p-4 mb-4 bg-[#e6f6f4] flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-[#00a991] animate-spin shrink-0" />
                  <span className="text-sm text-slate-500">
                    Memproses pipeline NLP...
                  </span>
                </div>
              )}

              {nlpError && (
                <div className="border border-red-200 rounded-xl p-4 mb-4 bg-red-50 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="text-sm text-red-600">{nlpError}</span>
                </div>
              )}

              {nlp && !nlpLoading && (
                <div className="border border-[#00a991]/30 rounded-xl overflow-hidden mb-5 shadow-sm">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#e6f6f4] border-b border-[#00a991]/20">
                    <SentimentBadge
                      label={nlp.sentiment.label}
                      score={nlp.sentiment.score}
                    />
                    <span className="text-xs text-slate-400 truncate max-w-[55%] text-right leading-snug">
                      {nlp.sentiment.tone}
                    </span>
                  </div>

                  <div className="bg-white px-4 py-3 space-y-3">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {nlp.summary
                        .split(/\*\*(.*?)\*\*/g)
                        .map((part, i) =>
                          i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
                        )}
                    </p>

                    <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                      {nlp.sentiment.breakdown.positif > 0 && (
                        <div
                          className="bg-emerald-400 rounded-full"
                          style={{
                            width: `${nlp.sentiment.breakdown.positif}%`,
                          }}
                        />
                      )}
                      {nlp.sentiment.breakdown.netral > 0 && (
                        <div
                          className="bg-blue-400 rounded-full"
                          style={{
                            width: `${nlp.sentiment.breakdown.netral}%`,
                          }}
                        />
                      )}
                      {nlp.sentiment.breakdown.waspada > 0 && (
                        <div
                          className="bg-amber-400 rounded-full"
                          style={{
                            width: `${nlp.sentiment.breakdown.waspada}%`,
                          }}
                        />
                      )}
                      {nlp.sentiment.breakdown.berbahaya > 0 && (
                        <div
                          className="bg-red-400 rounded-full"
                          style={{
                            width: `${nlp.sentiment.breakdown.berbahaya}%`,
                          }}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {nlp.sentiment.breakdown.positif > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                          Positif {nlp.sentiment.breakdown.positif}%
                        </span>
                      )}
                      {nlp.sentiment.breakdown.netral > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                          Netral {nlp.sentiment.breakdown.netral}%
                        </span>
                      )}
                      {nlp.sentiment.breakdown.waspada > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                          Waspada {nlp.sentiment.breakdown.waspada}%
                        </span>
                      )}
                      {nlp.sentiment.breakdown.berbahaya > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                          Berbahaya {nlp.sentiment.breakdown.berbahaya}%
                        </span>
                      )}
                    </div>

                    <div className="border-t border-slate-100" />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2.5">
                        {nlp.highlights.warnings.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> Perlu
                              diwaspadai
                            </p>
                            <ul className="space-y-1">
                              {nlp.highlights.warnings
                                .slice(0, 4)
                                .map((w, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-amber-700 flex items-center gap-1.5"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                    {w}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                        {nlp.highlights.positives.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Kondisi
                              positif
                            </p>
                            <ul className="space-y-1">
                              {nlp.highlights.positives
                                .slice(0, 3)
                                .map((p, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-emerald-700 flex items-center gap-1.5"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    {p}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {nlp.advice.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1.5">
                            💡 Rekomendasi
                          </p>
                          <ul className="space-y-1">
                            {nlp.advice.slice(0, 5).map((a, i) => (
                              <li
                                key={i}
                                className="text-xs text-slate-600 flex items-start gap-1.5"
                              >
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#00a991] shrink-0" />
                                {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <details className="border-t border-slate-100 pt-2">
                      <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-500 select-none">
                        📊 Lihat parameter cuaca terdeteksi
                      </summary>
                      <div className="pt-2 space-y-2">
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">
                            Kondisi teridentifikasi
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {nlpResult?.pipeline.step3_stemmed.concepts.map(
                              (c, i) => {
                                const color = {
                                  positif: "bg-emerald-100 text-emerald-700",
                                  netral: "bg-blue-100 text-blue-700",
                                  waspada: "bg-amber-100 text-amber-700",
                                  berbahaya: "bg-red-100 text-red-700",
                                }[c.sentiment];
                                return (
                                  <span
                                    key={i}
                                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${color}`}
                                  >
                                    {c.humanLabel}
                                  </span>
                                );
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    </details>

                    {/* ─── Validasi & Akurasi Pipeline ──────────────────── */}
                    {nlpResult?.pipeline.validation && nlpResult?.pipeline.accuracy && (() => {
                      const validation = nlpResult.pipeline.validation;
                      const accuracy = nlpResult.pipeline.accuracy;
                      const stages: Array<{ key: "tokenizing" | "stemming" | "features" | "reasoning" | "nlg" | "sentiment" | "highlights"; label: string }> = [
                        { key: "tokenizing", label: "Tokenizing" },
                        { key: "stemming", label: "Stemming" },
                        { key: "features", label: "Features" },
                        { key: "reasoning", label: "Reasoning" },
                        { key: "nlg", label: "NLG" },
                        { key: "sentiment", label: "Sentiment" },
                        { key: "highlights", label: "Highlights" },
                      ];
                      const avgScore = Math.round(
                        stages.reduce((sum, s) => sum + accuracy[s.key].score, 0) / stages.length,
                      );
                      const testAcc = nlpResult?.testAccuracy;
                      const fixtureScore = testAcc ? testAcc.score : avgScore;
                      const statusIcon = (st: string) => {
                        if (st === "passed") return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
                        if (st === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
                        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
                      };
                      return (
                        <details open className="border border-slate-200 rounded-xl overflow-hidden mt-4 group">
                          <summary className="px-4 py-2.5 bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                            <BarChart3 className="h-4 w-4 text-[#00a991] shrink-0" />
                            <span>Pipeline Validasi &amp; Akurasi Algoritma</span>
                            <span className="text-xs font-mono text-slate-400 ml-2 hidden sm:inline">({avgScore}% / {testAcc?.score ?? "—"}%)</span>
                            <ChevronRight className="h-4 w-4 ml-auto text-slate-400 transition-transform group-open:rotate-90" />
                          </summary>
                          <div className="p-4 space-y-4 text-sm">
                            {/* ─── Bar Overfitting / Underfitting ────────────── */}
                            <div>
                              <h4 className="font-semibold text-slate-700 mb-2">Indikasi Overfitting</h4>
                              <div className="relative h-5 bg-gradient-to-r from-red-400 via-emerald-400 to-amber-400 rounded-full overflow-hidden">
                                <div
                                  className="absolute top-0 h-full w-0.5 bg-slate-900 rounded-full transition-all duration-300"
                                  style={{ left: `clamp(0%, ${fixtureScore}%, 100%)` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-bold text-white/90 drop-shadow">
                                  <span>Underfit</span>
                                  <span>Ideal</span>
                                  <span>Overfit</span>
                                </div>
                              </div>
                              <p className="text-xs mt-1.5 text-slate-600">
                                {testAcc
                                  ? `Berdasarkan ${testAcc.total} check terhadap ground truth: ${testAcc.passed}/${testAcc.total} (${testAcc.score}%)`
                                  : "Memuat data akurasi..."}
                              </p>
                              {testAcc && (
                                <p className="text-xs mt-0.5 text-slate-500">
                                  {testAcc.score >= 95
                                    ? "⚠ Potensi overfitting — akurasi terlalu tinggi, fixture perlu diverifikasi ulang"
                                    : testAcc.score >= 70
                                      ? "✓ Akurasi dalam rentang ideal — algoritma tidak overfit maupun underfit"
                                      : "✗ Underfitting — akurasi rendah, algoritma perlu diperbaiki"}
                                </p>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-700 mb-2">Ringkasan per Stage</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="text-left py-1.5 px-2 font-medium text-slate-500">Stage</th>
                                      <th className="text-left py-1.5 px-2 font-medium text-slate-500">Validasi</th>
                                      <th className="text-right py-1.5 px-2 font-medium text-slate-500">Akurasi</th>
                                      <th className="text-right py-1.5 px-2 font-medium text-slate-500">Checks</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stages.map((s) => {
                                      const val = validation[s.key];
                                      const acc = accuracy[s.key];
                                      const passedChecks = val.checks.filter((c) => c.status === "passed").length;
                                      return (
                                        <tr key={s.key} className="border-b border-slate-100">
                                          <td className="py-1.5 px-2 font-medium text-slate-700">{s.label}</td>
                                          <td className="py-1.5 px-2">
                                            <span className="flex items-center gap-1">
                                              {statusIcon(val.status)}
                                              <span className={
                                                val.status === "passed"
                                                  ? "text-emerald-600"
                                                  : val.status === "warning"
                                                    ? "text-amber-600"
                                                    : "text-red-600"
                                              }>{val.status.charAt(0).toUpperCase() + val.status.slice(1)}</span>
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-right">
                                            <span className={
                                              acc.score >= 90
                                                ? "text-emerald-600"
                                                : acc.score >= 70
                                                  ? "text-amber-600"
                                                  : "text-red-600"
                                            }>{acc.score}/100</span>
                                          </td>
                                          <td className="py-1.5 px-2 text-right text-slate-500">{passedChecks}/{val.checks.length}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t border-slate-200 font-semibold">
                                      <td className="py-2 px-2 text-slate-700" colSpan={2}>Rata-rata Akurasi</td>
                                      <td className="py-2 px-2 text-right text-[#00a991]">{avgScore}/100</td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                            <details className="border border-slate-200 rounded-lg overflow-hidden group/detail">
                              <summary className="px-3 py-2 bg-slate-50 cursor-pointer text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                                <ChevronRight className="h-3 w-3 text-slate-400 transition-transform group-open/detail:rotate-90" />
                                Detail Setiap Stage
                              </summary>
                              <div className="divide-y divide-slate-100">
                                {stages.map((s) => {
                                  const val = validation[s.key];
                                  const acc = accuracy[s.key];
                                  return (
                                    <details key={s.key} className="group/stage">
                                      <summary className="px-3 py-2 cursor-pointer text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                                        <ChevronRight className="h-3 w-3 text-slate-400 transition-transform group-open/stage:rotate-90" />
                                        {s.label}
                                        <span className="ml-auto flex items-center gap-2">
                                          {statusIcon(val.status)}
                                          <span className={
                                            acc.score >= 90
                                              ? "text-emerald-600"
                                              : acc.score >= 70
                                                ? "text-amber-600"
                                                : "text-red-600"
                                          }>{acc.score}%</span>
                                        </span>
                                      </summary>
                                      <div className="px-4 py-2 space-y-2 bg-slate-50/50">
                                        <div>
                                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Validasi</p>
                                          {val.checks.map((c, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-[11px]">
                                              {statusIcon(c.status)}
                                              <div>
                                                <span className="font-medium text-slate-700">{c.name}</span>
                                                <p className="text-slate-500">{c.message.replace(/^[✓✗]\s*/, "")}</p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Akurasi</p>
                                          {acc.checks.map((c, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-[11px]">
                                              {statusIcon(c.status)}
                                              <div className="flex-1 min-w-0">
                                                <span className="font-medium text-slate-700">{c.name}</span>
                                                <p className="text-slate-500">{c.message.replace(/^[✓✗]\s*/, "")}</p>
                                                {c.detail && <p className="text-slate-400 italic">{c.detail}</p>}
                                              </div>
                                              <span className="shrink-0 text-[10px] font-mono text-slate-400">{c.score}/100</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </details>
                          </div>
                        </details>
                      );
                    })()}

                    {/* ─── XAI Section ─────────────────────────────── */}
                    {nlpResult?.pipeline.step5_xai && (() => {
                      const xai = nlpResult.pipeline.step5_xai;
                      return (
                        <details className="border border-slate-200 rounded-xl overflow-hidden mt-4 group">
                          <summary className="px-4 py-2.5 bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                            <Sparkles className="h-4 w-4 text-[#00a991] shrink-0" />
                            <span>Explainability (XAI) — Mengapa kesimpulan ini?</span>
                            <ChevronRight className="h-4 w-4 ml-auto text-slate-400 transition-transform group-open:rotate-90" />
                          </summary>
                          <div className="p-4 space-y-5 text-sm">

                            {/* ── Tokenizing XAI ── */}
                            {xai.tokenizing.classifications.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                  <Search className="h-3.5 w-3.5 text-[#00a991]" /> Klasifikasi Parameter
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {xai.tokenizing.classifications.map((c, i) => (
                                    <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-xs">
                                      <span className="text-slate-400">{c.parameter}: </span>
                                      <span className="font-mono text-slate-700">{c.rawValue}</span>
                                      <span className="text-slate-400"> → </span>
                                      <span className="font-medium text-[#00a991]">{c.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ── Stemming XAI ── */}
                            {xai.stemming.concepts.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                  <BarChart3 className="h-3.5 w-3.5 text-[#00a991]" /> Bobot Konsep & Boost
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-slate-200">
                                        <th className="text-left py-1.5 pr-2">Konsep</th>
                                        <th className="text-center py-1.5 px-2">Dasar</th>
                                        <th className="text-center py-1.5 px-2">Boost</th>
                                        <th className="text-center py-1.5 px-2">Final</th>
                                        <th className="text-left py-1.5 pl-2">Sumber Boost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {xai.stemming.concepts.map((c, i) => (
                                        <tr key={i} className="border-b border-slate-100">
                                          <td className="py-1.5 pr-2">
                                            <span className="font-medium text-slate-700">{c.humanLabel}</span>
                                            <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${
                                              c.sentiment === "positif" ? "bg-emerald-100 text-emerald-700" :
                                              c.sentiment === "netral" ? "bg-blue-100 text-blue-700" :
                                              c.sentiment === "waspada" ? "bg-amber-100 text-amber-700" :
                                              "bg-red-100 text-red-700"
                                            }`}>{c.sentiment}</span>
                                          </td>
                                          <td className="text-center py-1.5 px-2 text-slate-500">{c.baseWeight.toFixed(2)}</td>
                                          <td className="text-center py-1.5 px-2">
                                            {c.boostAmount > 0 ? (
                                              <span className="text-amber-600 font-medium">+{c.boostAmount.toFixed(2)}</span>
                                            ) : (
                                              <span className="text-slate-300">—</span>
                                            )}
                                          </td>
                                          <td className="text-center py-1.5 px-2 font-medium text-slate-700">{c.finalWeight.toFixed(2)}</td>
                                          <td className="py-1.5 pl-2 text-[10px] text-slate-400 max-w-32 truncate" title={c.boostSources.join(", ")}>
                                            {c.boostSources.length > 0 ? c.boostSources.join(", ") : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Bobot 0.0–1.0. Boost berasal dari rule reasoning yang mendeteksi kombinasi konsep berbahaya.
                                </p>
                              </div>
                            )}

                            {/* ── Features XAI ── */}
                            <div>
                              <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-[#00a991]" /> Faktor Penguat (N-gram & TF-IDF)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {xai.features.ngramBoosts.length > 0 && (
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-slate-500 mb-1.5">N-gram dengan Domain Boost</p>
                                    <div className="space-y-1.5">
                                      {xai.features.ngramBoosts.slice(0, 5).map((ng, i) => (
                                        <div key={i} className="text-[11px]">
                                          <span className="font-mono text-slate-700">{ng.ngram}</span>
                                          <span className="text-slate-400 mx-1">→</span>
                                          <span className="font-medium text-amber-600">{ng.boost}x</span>
                                          {ng.boost > 1 && (
                                            <p className="text-[10px] text-slate-400 ml-1">{ng.boostReason}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {xai.features.tfidfHighlights.length > 0 && (
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-slate-500 mb-1.5">TF-IDF Term Signifikan</p>
                                    <div className="space-y-1.5">
                                      {xai.features.tfidfHighlights.slice(0, 5).map((t, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[11px]">
                                          <span className="font-mono text-slate-700 min-w-20">{t.term}</span>
                                          <span className="text-slate-400">TF-IDF: {t.tfidf.toFixed(4)}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                            t.significance === "tinggi" ? "bg-red-100 text-red-600" :
                                            t.significance === "sedang" ? "bg-amber-100 text-amber-600" :
                                            "bg-slate-100 text-slate-500"
                                          }`}>{t.significance}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ── Reasoning XAI ── */}
                            <div>
                              <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5 text-[#00a991]" /> Rule Reasoning Aktif ({xai.reasoning.activeRules.length}/{xai.reasoning.totalRules})
                              </h4>
                              {xai.reasoning.activeRules.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Tidak ada rule yang aktif untuk kondisi cuaca saat ini.</p>
                              ) : (
                                <div className="space-y-2">
                                  {xai.reasoning.activeRules.map((rule, i) => (
                                    <div key={i} className="bg-slate-50 rounded-lg p-3 border-l-4 border-[#00a991]">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-slate-700">
                                            <span className="font-mono text-[#00a991]">#{rule.ruleId}</span> {rule.label}
                                          </p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">
                                            Kondisi: {rule.matchedConditions.map((c, j) => (
                                              <span key={j} className="inline-block bg-white px-1.5 py-0.5 rounded text-slate-600 font-mono mx-0.5">{c}</span>
                                            ))}
                                          </p>
                                          <p className="text-[10px] text-slate-500 mt-1">{rule.advice}</p>
                                        </div>
                                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                                          rule.severity < 0 ? "bg-emerald-100 text-emerald-700" :
                                          rule.severity >= 0.4 ? "bg-red-100 text-red-700" :
                                          "bg-amber-100 text-amber-700"
                                        }`}>
                                          {rule.impactDescription}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* ── Sentiment XAI ── */}
                            <div>
                              <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5 text-[#00a991]" /> Detail Sentimen
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-lg p-3">
                                  <p className="text-xs font-medium text-slate-500 mb-1.5">Distribusi per Kategori</p>
                                  <div className="space-y-2">
                                    {xai.sentiment.breakdownDetail.filter(b => b.count > 0).map((b, i) => (
                                      <div key={i}>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className={`font-medium ${
                                            b.category === "Positif" ? "text-emerald-600" :
                                            b.category === "Netral" ? "text-blue-600" :
                                            b.category === "Waspada" ? "text-amber-600" :
                                            "text-red-600"
                                          }`}>{b.category}</span>
                                          <span className="text-slate-400">{b.count} konsep ({b.percentage}%)</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                          {b.concepts.join(", ")}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-slate-500 mb-1">Penjelasan Skor</p>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">{xai.sentiment.scoreExplanation}</p>
                                  </div>
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-slate-500 mb-1">Penjelasan Label</p>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">{xai.sentiment.labelExplanation}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* ── Highlight XAI ── */}
                            <div>
                              <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-[#00a991]" /> Alasan Highlight
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {xai.highlights.warnings.length > 0 && (
                                  <div className="bg-red-50 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                                      <ShieldAlert className="h-3 w-3" /> Perlu Diwaspadai
                                    </p>
                                    <div className="space-y-1.5">
                                      {xai.highlights.warnings.map((w, i) => (
                                        <div key={i} className="text-xs">
                                          <p className="font-medium text-red-700">{w.text}</p>
                                          <p className="text-[10px] text-red-500 mt-0.5">{w.reason}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {xai.highlights.positives.length > 0 && (
                                  <div className="bg-emerald-50 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" /> Kondisi Positif
                                    </p>
                                    <div className="space-y-1.5">
                                      {xai.highlights.positives.map((p, i) => (
                                        <div key={i} className="text-xs">
                                          <p className="font-medium text-emerald-700">{p.text}</p>
                                          <p className="text-[10px] text-emerald-500 mt-0.5">{p.reason}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        </details>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectedNews(null)}
                className="text-[#00a991] text-sm mb-4 flex items-center gap-1 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali ke ringkasan
              </button>
              <div className="rounded-xl bg-teal-50 h-44 flex items-center justify-center mb-5">
                <Wind className="h-20 w-20 text-teal-200" />
              </div>
              <p className="text-slate-700 leading-relaxed text-sm">
                {selectedNews.content}
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                <span className="bg-[#e6f6f4] text-[#008774] text-xs px-3 py-1 rounded-full font-medium">
                  Energi Terbarukan
                </span>
                <span className="bg-[#e6f6f4] text-[#008774] text-xs px-3 py-1 rounded-full font-medium">
                  Prakiraan Ventara
                </span>
                <span className="bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full">
                  📍 {locationName}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function RealtimePage() {
  const [activeView, setActiveView] = useState<ActiveView>("daily");
  const [trendFilter, setTrendFilter] = useState<TrendFilter>("hourly");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locName, setLocName] = useState("");
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [hourly, setHourly] = useState<HourlyData | null>(null);
  const [avgWind, setAvgWind] = useState("-");
  const [dominantDir, setDominantDir] = useState("—");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [modalData, setModalData] = useState<ModalData | null>(null);

  const [searchSuggestions, setSearchSuggestions] = useState<
    { lat: number; lng: number; displayName: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchValueRef = useRef("");

  interface LocationCache {
    daily: DailyData | null;
    hourly: HourlyData | null;
    avgWind: string;
    dominantDir: string;
    news: NewsItem[];
    timestamp: number;
  }

  const locationCacheRef = useRef(new Map<string, LocationCache>());
  const CACHE_TTL = 5 * 60 * 1000;

  function generateRegionId(lat: number, lng: number): string {
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
  }

  function getCachedData(regionId: string): LocationCache | null {
    const cached = locationCacheRef.current.get(regionId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      locationCacheRef.current.delete(regionId);
      return null;
    }
    return cached;
  }

  function validateRegion(lat: number, lng: number, name: string) {
    const regionId = generateRegionId(lat, lng);
    const isValid = lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141;
    return { lat, lng, name, isValid, regionId };
  }

  const loadLocation = useCallback(
    async (newLat: number, newLng: number, name: string) => {
      const validation = validateRegion(newLat, newLng, name);
      if (!validation.isValid)
        setError(
          `Wilayah ${name} di luar jangkauan Indonesia. Menggunakan data default.`,
        );

      setShowSuggestions(false);
      setIsLoading(true);
      setError(null);

      const regionId = validation.regionId;
      const cached = getCachedData(regionId);

      if (cached) {
        setDaily(cached.daily);
        setHourly(cached.hourly);
        setAvgWind(cached.avgWind);
        setDominantDir(cached.dominantDir);
        setNews(cached.news);
        setLat(newLat);
        setLng(newLng);
        setLocName(name);
        setIsLoading(false);
        return;
      }

      try {
        setNews([]);
        const [dailyData, hourlyData] = await Promise.all([
          fetchDaily(newLat, newLng),
          fetchHourly(newLat, newLng),
        ]);
        const speeds = dailyData.wind_speed_10m_max;
        const avg =
          speeds.length > 0
            ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)
            : "0";
        const dir = dailyData.wind_direction_10m_dominant[0]
          ? degToCardinal(dailyData.wind_direction_10m_dominant[0])
          : "—";
        const cacheData: LocationCache = {
          daily: dailyData,
          hourly: hourlyData,
          avgWind: avg + " km/jam",
          dominantDir: dir,
          news: generateNews(name, avg, dir),
          timestamp: Date.now(),
        };
        locationCacheRef.current.set(regionId, cacheData);
        setDaily(dailyData);
        setHourly(hourlyData);
        setAvgWind(avg + " km/jam");
        setDominantDir(dir);
        setNews(cacheData.news);
        setLat(newLat);
        setLng(newLng);
        setLocName(name);
        localStorage.setItem("ventara_lat", newLat.toString());
        localStorage.setItem("ventara_lng", newLng.toString());
        localStorage.setItem("ventara_name", name);
      } catch (e: unknown) {
        const cached = getCachedData(regionId);
        if (cached) {
          setDaily(cached.daily);
          setHourly(cached.hourly);
          setAvgWind(cached.avgWind);
          setDominantDir(cached.dominantDir);
          setNews(cached.news);
          setError(
            `Gagal memuat data terbaru. Menampilkan data cache untuk ${name}.`,
          );
        } else {
          setError(e instanceof Error ? e.message : "Gagal memuat data cuaca.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ventara_lat");
      localStorage.removeItem("ventara_lng");
      localStorage.removeItem("ventara_name");
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const handleSearchInput = (value: string) => {
    searchValueRef.current = value;
    setSearchQuery(value);
    setError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.length >= 2) {
      setSearchLoading(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const suggestions = await searchLocationSuggestions(value);
          setSearchSuggestions(suggestions);
          setShowSuggestions(true);
        } catch {
          setSearchSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
      }, 350);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: {
    lat: number;
    lng: number;
    displayName: string;
  }) => {
    searchValueRef.current = suggestion.displayName;
    setSearchQuery(suggestion.displayName);
    setShowSuggestions(false);
    setSearchSuggestions([]);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    await loadLocation(suggestion.lat, suggestion.lng, suggestion.displayName);
  };

  const handleSearch = async (value?: string) => {
    const q = (value ?? searchValueRef.current).trim();
    if (!q) return;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setSearchLoading(true);
    setShowSuggestions(false);
    try {
      const { lat: sLat, lng: sLng, displayName } = await searchLocationAPI(q);
      setSearchQuery(displayName);
      searchValueRef.current = displayName;
      await loadLocation(sLat, sLng, displayName);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mencari lokasi.");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Header />
        <div className="p-8">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Search */}
            <div
              ref={searchRef}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 relative z-40"
            >
              <div className="relative flex items-center gap-3">
                {searchLoading ? (
                  <Loader2 className="absolute left-4 h-4 w-4 text-[#00a991] z-10 animate-spin" />
                ) : (
                  <Search className="absolute left-4 h-4 w-4 text-[#00a991] z-10" />
                )}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch(e.currentTarget.value);
                  }}
                  onFocus={() =>
                    searchSuggestions.length > 0 && setShowSuggestions(true)
                  }
                  placeholder="Cari lokasi (kota / pulau)..."
                  className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00a991]/60 focus:border-transparent transition text-sm shadow-inner"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={searchLoading}
                  className="shrink-0 px-5 py-3 bg-[#00a991] hover:bg-[#008774] disabled:bg-[#7f9e96] text-white text-sm font-medium rounded-xl transition flex items-center gap-2"
                >
                  {searchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </button>
              </div>
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute left-4 right-4 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-center gap-3 transition-colors"
                    >
                      <MapPin className="h-4 w-4 text-[#00a991] shrink-0" />
                      <span className="text-sm text-slate-700 truncate">
                        {s.displayName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions &&
                searchSuggestions.length === 0 &&
                searchQuery.length >= 2 &&
                !searchLoading && (
                  <div className="absolute left-4 right-4 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 text-center text-sm text-slate-500">
                    Tidak ada lokasi yang ditemukan
                  </div>
                )}
            </div>

            {/* Map + Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
              <div className="p-4 pb-2">
                <MapComponent lat={lat} lng={lng} locationName={locName} />
              </div>
              {lat !== null && lng !== null && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-5 pb-5 pt-2 text-sm">
                  {[
                    {
                      Icon: MapPin,
                      label: "Koordinat:",
                      value: `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
                      mono: true,
                    },
                    {
                      Icon: MapPin,
                      label: "Lokasi:",
                      value: locName,
                      bold: true,
                    },
                    {
                      Icon: Wind,
                      label: "Rata-rata angin (7 hari):",
                      value: avgWind,
                      bold: true,
                    },
                    {
                      Icon: Compass,
                      label: "Arah dominan (hari ini):",
                      value: dominantDir,
                    },
                  ].map(({ Icon, label, value, mono, bold }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#00a991] shrink-0" />
                      <span className="font-medium text-slate-500">
                        {label}
                      </span>
                      <span
                        className={`text-slate-800 ${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""}`}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            {lat !== null && lng !== null && (
              <div className="flex gap-3">
                {(["daily", "trends"] as ActiveView[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setActiveView(v)}
                    className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-sm ${activeView === v ? "bg-[#00a991] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {v === "daily" ? (
                      <>
                        <Clock className="h-4 w-4" /> Daily
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-4 w-4" /> Trends
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
                {lat !== null && lng !== null && (
                  <button
                    onClick={() => loadLocation(lat, lng, locName)}
                    className="ml-auto flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="h-4 w-4" /> Coba lagi
                  </button>
                )}
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-teal-100 border-t-[#00a991] rounded-full animate-spin" />
                <span className="text-sm text-slate-500">
                  Memuat prakiraan angin 7 hari...
                </span>
              </div>
            )}

            {/* Daily */}
            {!isLoading && !error && activeView === "daily" && daily && (
              <div className="space-y-4">
                <Carousel>
                  {daily.time.map((date, i) => (
                    <WindCard
                      key={date}
                      date={date}
                      speed={daily.wind_speed_10m_max[i]}
                      dir={daily.wind_direction_10m_dominant[i]}
                      index={i}
                    />
                  ))}
                </Carousel>
                <Carousel>
                  {daily.time.map((date, i) => (
                    <WeatherCard
                      key={date}
                      date={date}
                      tempMax={daily.temperature_2m_max[i]}
                      tempMin={daily.temperature_2m_min[i]}
                      weatherCode={daily.weathercode[i]}
                      weatherPrimary={daily.weatherPrimary[i]}
                      windSpeed={daily.wind_speed_10m_max[i]}
                      index={i}
                      onDetail={setModalData}
                    />
                  ))}
                </Carousel>
              </div>
            )}

            {/* Trends */}
            {!isLoading && !error && activeView === "trends" && (
              <TrendsView
                hourlyData={hourly}
                filter={trendFilter}
                onFilterChange={setTrendFilter}
              />
            )}

            {/* Detail Modal */}
            <DetailModal
              data={modalData}
              news={news}
              locationName={locName}
              lat={lat}
              lng={lng}
              onClose={() => setModalData(null)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}