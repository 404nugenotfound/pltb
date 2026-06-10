"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface VarStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  missing: number;
  total: number;
}

interface EDAData {
  stats: Record<string, VarStats>;
  rows: number;
  cols: number;
  trend?: Record<string, number[]>;        // ← dari backend nanti
  trend_labels?: string[];
}

type Tab = "stats" | "trend" | "boxplot";

const VAR_COLORS: Record<string, { bg: string; border: string; text: string; line: string }> = {
  RH2M:  { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   line: "#3b82f6" },
  WS10M: { bg: "bg-teal-50",   border: "border-teal-200",   text: "text-teal-700",   line: "#14b8a6" },
  WD10M: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", line: "#8b5cf6" },
};

const STAT_LABELS = [
  { key: "mean",   label: "Mean" },
  { key: "median", label: "Median" },
  { key: "std",    label: "Std Dev" },
  { key: "min",    label: "Min" },
  { key: "max",    label: "Max" },
] as const;

const TABS = [
  { id: "stats",   label: "Statistik",  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "trend",   label: "Trend",      icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { id: "boxplot", label: "Boxplot",    icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
] as const;

// Boxplot manual pakai recharts composable
function BoxplotCard({ variable, stats, color }: {
  variable: string;
  stats: VarStats;
  color: typeof VAR_COLORS[string];
}) {
  const { min, max, mean, median, std } = stats;
  const q1 = mean - std;
  const q3 = mean + std;
  const range = max - min || 1;

  const pct = (val: number) => `${Math.max(0, Math.min(100, ((val - min) / range) * 100))}%`;

  return (
    <div className={`rounded-xl border p-4 ${color.bg} ${color.border}`}>
      <p className={`font-bold text-sm mb-4 ${color.text}`}>{variable}</p>

      {/* Box plot visual */}
      <div className="relative h-12 flex items-center mb-3">
        {/* Whisker kiri */}
        <div className="absolute h-0.5 bg-gray-400"
          style={{ left: pct(min), width: `calc(${pct(q1)} - ${pct(min)})` }} />
        {/* Min tick */}
        <div className="absolute w-0.5 h-3 bg-gray-400" style={{ left: pct(min) }} />

        {/* Box IQR */}
        <div className={`absolute h-6 rounded border-2 ${color.border}`}
          style={{
            left: pct(q1),
            width: `calc(${pct(q3)} - ${pct(q1)})`,
            backgroundColor: color.line + "20"
          }} />

        {/* Median line */}
        <div className="absolute w-0.5 h-6 z-10"
          style={{ left: pct(median), backgroundColor: color.line }} />

        {/* Mean dot */}
        <div className="absolute w-2 h-2 rounded-full z-10 -translate-x-1"
          style={{ left: pct(mean), backgroundColor: color.line }} />

        {/* Whisker kanan */}
        <div className="absolute h-0.5 bg-gray-400"
          style={{ left: pct(q3), width: `calc(${pct(max)} - ${pct(q3)})` }} />
        {/* Max tick */}
        <div className="absolute w-0.5 h-3 bg-gray-400" style={{ left: pct(max) }} />
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-1 text-xs text-gray-500">
        <span>Min: <b className="text-gray-700">{min}</b></span>
        <span className="text-center">Median: <b className="text-gray-700">{median}</b></span>
        <span className="text-right">Max: <b className="text-gray-700">{max}</b></span>
        <span>Q1≈ <b className="text-gray-700">{q1.toFixed(2)}</b></span>
        <span className="text-center">Mean: <b className="text-gray-700">{mean}</b></span>
        <span className="text-right">Q3≈ <b className="text-gray-700">{q3.toFixed(2)}</b></span>
      </div>
    </div>
  );
}

export default function EDASection() {
  const [data, setData]       = useState<EDAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("stats");

  useEffect(() => {
    fetch("/api/eda-summary", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-100 rounded w-1/4" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    </div>
  );

  if (!data) return null;

  // Siapkan data trend — pakai sample tiap 30 titik biar ga berat
  const trendData = data.trend
    ? data.trend_labels!.map((label, i) => ({
        label,
        ...Object.fromEntries(
          Object.entries(data.trend!).map(([k, v]) => [k, v[i]])
        ),
      }))
    : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900 text-lg">Exploratory Data Analysis</h3>
            <p className="text-sm text-gray-400">--  Statistik deskriptif dataset aktif</p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
            {data.rows.toLocaleString()} baris
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
            {data.cols} kolom
          </span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-teal-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: STATISTIK ── */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(data.stats).map(([variable, stats]) => {
            const color = VAR_COLORS[variable] ?? {
              bg: "bg-gray-50", border: "border-gray-200",
              text: "text-gray-700", line: "#6b7280"
            };
            return (
              <div key={variable} className={`rounded-xl border p-4 ${color.bg} ${color.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-bold text-sm ${color.text}`}>{variable}</span>
                  {stats.missing > 0 ? (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                      {stats.missing} missing
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                      ✓ Lengkap
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {STAT_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-800">{stats[key]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{stats.min}</span>
                    <span>Range</span>
                    <span>{stats.max}</span>
                  </div>
                  <div className="h-1.5 bg-white rounded-full border border-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, ((stats.mean - stats.min) / ((stats.max - stats.min) || 1)) * 100)}%`,
                        backgroundColor: color.line
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-1">
                    mean di {Math.round(((stats.mean - stats.min) / ((stats.max - stats.min) || 1)) * 100)}% range
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: TREND ── */}
      {activeTab === "trend" && (
  <div>
    {trendData.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <p className="text-sm">Data trend belum tersedia</p>
      </div>
    ) : (
      <div>
        {/* Judul axis */}
        <div className="flex justify-between text-xs text-gray-400 mb-1 px-1">
          <span>Nilai</span>
          <span>Waktu (index data)</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData} margin={{ top: 5, right: 10, left: 20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                label={{ value: "Waktu (index data)", position: "insideBottom", offset: -10, fontSize: 11, fill: "#9ca3af" }}
            />
            <YAxis
                tick={{ fontSize: 10 }}
                width={45}
                label={{ value: "Nilai", angle: -90, position: "insideLeft", offset: -5, fontSize: 11, fill: "#9ca3af" }}
            />
            <Tooltip />
            <Legend verticalAlign="top" height={36} />
            {Object.keys(data.stats).map((variable) => (
                <Line
                key={variable}
                type="monotone"
                dataKey={variable}
                stroke={VAR_COLORS[variable]?.line ?? "#6b7280"}
                dot={false}
                strokeWidth={1.5}
                />
            ))}
           </LineChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
)}

      {/* ── TAB: BOXPLOT ── */}
      {activeTab === "boxplot" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(data.stats).map(([variable, stats]) => {
            const color = VAR_COLORS[variable] ?? {
              bg: "bg-gray-50", border: "border-gray-200",
              text: "text-gray-700", line: "#6b7280"
            };
            return (
              <BoxplotCard
                key={variable}
                variable={variable}
                stats={stats}
                color={color}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}