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

import { Line } from "react-chartjs-2";

import { useState } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

interface Props {
  labels: string[];

  actualData: number[];

  datasets: {
    GBR: number[];
    XGB: number[];
    KNN: number[];
    LSTM: number[];
    BiLSTM: number[];
  };
}

export default function ForecastChart({ labels, actualData, datasets }: Props) {
  const [selectedModel, setSelectedModel] = useState("GBR");

  const colorMap: Record<string, string> = {
    GBR: "#14b8a6",
    XGB: "#3b82f6",
    KNN: "#f59e0b",
    LSTM: "#8b5cf6",
    BiLSTM: "#ec4899",
  };

  const chartData = {
    labels,

    datasets: [
      {
        label: "Aktual",

        data: actualData,

        borderColor: "rgba(107,114,128,0.9)",

        borderDash: [10, 6],

        borderWidth: 4,

        tension: 0.4,
      },

      {
        label: selectedModel,

        data: datasets[selectedModel as keyof typeof datasets],

        borderColor: colorMap[selectedModel],

        borderWidth: 4,

        tension: 0.4,
      },
    ],
  };

  return (
    <div
      className="
      bg-white p-6 rounded-2xl
      border border-gray-100
      shadow-sm
      "
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-gray-800 text-lg">
            Grafik Prediksi vs Aktual
          </h3>

          <p className="text-sm text-gray-400">
            Bandingkan hasil model dengan data aktual
          </p>
        </div>

        {/* SELECT */}
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="
          border border-gray-200 text-black
          rounded-xl px-4 py-2 text-sm
          focus:outline-none
          focus:ring-2
          focus:ring-teal-500
          "
        >
          <option value="GBR">GBR</option>
          <option value="XGB">XGBoost</option>
          <option value="KNN">KNN</option>
          <option value="LSTM">LSTM</option>
          <option value="BiLSTM">Bi-LSTM</option>
        </select>
      </div>

      {/* CHART */}
      <div className="h-80">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // ✅ matikan animasi — sering bikin hitam di Next.js
            elements: {
              point: {
                radius: 0, // ✅ hilangkan titik — lebih bersih
              },
            },
            plugins: {
              legend: {
                display: true,
              },
            },
            scales: {
              x: {
                grid: { display: false },
              },
              y: {
                grid: { color: "rgba(0,0,0,0.05)" },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
