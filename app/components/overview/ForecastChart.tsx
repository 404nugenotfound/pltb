"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { Line } from "react-chartjs-2";
import { useState, useEffect } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  annotationPlugin,
);

interface Props {
  mode?: string;
  varParam?: string;
  onVarChange?: (v: string) => void;
}

interface ForecastData {
  mode: string;
  var: string;
  labels: string[];
  actual: number[];
  actual_dict: Record<string, number[]>;
  predictions: Record<string, number[]>;
  future_start_index: number;
}

const actualColorMap: Record<string, string> = {
  WS10M: "rgba(107,114,128,0.9)",
  WD10M: "rgba(156,163,175,0.9)",
  RH2M:  "rgba(75,85,99,0.9)",
};

const paletteColors = ["#14b8a6", "#3b82f6", "#f59e0b"];

const colorMap: Record<string, string> = {
  GBR:    "#14b8a6",
  XGB:    "#3b82f6",
  KNN:    "#f59e0b",
  LSTM:   "#8b5cf6",
  BiLSTM: "#ec4899",
};

export default function ForecastChart({
  mode = "general",
  varParam = "WS10M",
  onVarChange,
}: Props) {
  const [selectedModel, setSelectedModel] = useState("GBR");
  const [localVar, setLocalVar]           = useState(varParam);
  const [data, setData]                   = useState<ForecastData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // sync localVar kalau varParam dari parent berubah
  useEffect(() => {
    setLocalVar(varParam);
  }, [varParam]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res  = await fetch(`/api/forecast-result?mode=${mode}&var=${localVar}`);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
          const firstModel = Object.keys(json.predictions)[0];
          if (firstModel) setSelectedModel(firstModel);
        }
      } catch {
        setError("Gagal mengambil data dari server.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mode, localVar]);

  const handleVarChange = (v: string) => {
    setLocalVar(v);
    onVarChange?.(v);
  };

  const availableModels = data ? Object.keys(data.predictions) : [];

  const chartData = data
    ? {
        labels: data.labels,
        datasets: [
          ...(mode === "general" && data.actual.length > 0
            ? [{
                label: "Aktual",
                data: data.actual,
                borderColor: "rgba(107,114,128,0.9)",
                borderDash: [10, 6] as number[],
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
              }]
            : []),
          ...(mode === "general"
            ? [{
                label: selectedModel,
                data: data.predictions[selectedModel] ?? [],
                borderColor: colorMap[selectedModel] ?? "#14b8a6",
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
              }]
            : [
                // aktual untuk var yang dipilih saja
                ...(data.actual_dict?.[localVar]
                  ? [{
                      label: `Aktual ${localVar}`,
                      data: data.actual_dict[localVar],
                      borderColor: actualColorMap[localVar] ?? "rgba(107,114,128,0.9)",
                      borderDash: [10, 6] as number[],
                      borderWidth: 2,
                      tension: 0.4,
                      pointRadius: 0,
                    }]
                  : []),
                // ensemble untuk var yang dipilih saja
                ...Object.entries(data.predictions)
                  .filter(([col]) => col.includes(localVar))
                  .map(([col, values], i) => ({
                    label: col,
                    data: values,
                    borderColor: paletteColors[i % paletteColors.length],
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                  })),
              ]
          ),
        ],
      }
    : { labels: [], datasets: [] };

  const futureLabel = data?.labels[data.future_start_index] ?? null;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 text-lg">
            Grafik Prediksi vs Aktual
          </h3>
          <p className="text-sm text-gray-400">
            -- Bandingkan hasil model dengan data aktual
          </p>
        </div>

        {mode === "general" ? (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={!data}
            className="border border-gray-200 text-black rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-40"
          >
            {availableModels.length > 0 ? (
              availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))
            ) : (
              <>
                <option value="GBR">GBR</option>
                <option value="XGB">XGBoost</option>
                <option value="KNN">KNN</option>
                <option value="LSTM">LSTM</option>
                <option value="BiLSTM">Bi-LSTM</option>
              </>
            )}
          </select>
        ) : (
          <select
            value={localVar}
            onChange={(e) => handleVarChange(e.target.value)}
            disabled={!data}
            className="border border-gray-200 text-black rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-40"
          >
            <option value="WS10M">WS10M</option>
            <option value="WD10M">WD10M</option>
            <option value="RH2M">RH2M</option>
          </select>
        )}
      </div>

      {/* CHART AREA */}
      <div className="h-80 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Memuat data forecast...</span>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-2xl">📭</span>
              <p className="text-sm text-gray-500 font-medium">{error}</p>
              <p className="text-xs text-gray-400">Jalankan proses generate terlebih dahulu.</p>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              plugins: {
                legend: { display: true },
                // @ts-ignore
                annotation: futureLabel
                  ? {
                      annotations: {
                        futureZone: {
                          type: "box",
                          xMin: futureLabel,
                          backgroundColor: "rgba(20,184,166,0.05)",
                          borderColor: "rgba(20,184,166,0.4)",
                          borderWidth: 1,
                          label: {
                            display: true,
                            content: "▶ Forecast 7 hari",
                            position: "start",
                            color: "#14b8a6",
                            font: { size: 11 },
                          },
                        },
                      },
                    }
                  : {},
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { maxTicksLimit: 10, maxRotation: 45, font: { size: 10 } },
                },
                y: {
                  grid: { color: "rgba(0,0,0,0.05)" },
                  ticks: { font: { size: 10 } },
                },
              },
            }}
          />
        )}
      </div>

      {!loading && !error && data && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <div className="w-4 h-3 rounded-sm bg-teal-500/10 border border-teal-400/40" />
          <span>Area berbayang = zona prediksi ke depan (168 jam / 7 hari)</span>
        </div>
      )}
    </div>
  );
}