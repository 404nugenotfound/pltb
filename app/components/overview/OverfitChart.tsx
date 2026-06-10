"use client";

import { useState, useEffect } from "react";

const METRICS = ["MAE", "RMSE", "sMAPE", "R2"] as const;
type Metric = (typeof METRICS)[number];

interface ModelMetrics {
  train: Record<Metric, number>;
  test: Record<Metric, number>;
}

interface OverfitData {
  [varName: string]: {
    [modelName: string]: ModelMetrics;
  };
}

interface OverfitChartProps {
  selectedVar?: string;
  mode?: string;
}

const COLOR_TRAIN = "#14b8a6";
const COLOR_TEST  = "#3b82f6";

function overfitGap(metric: Metric, train: number, test: number) {
  return metric === "R2" ? train - test : test - train;
}

function getThreshold(metric: Metric) {
  if (metric === "sMAPE") return { fit: 20, warn: 40 };
  return { fit: 15, warn: 25 };
}

function OverfitBadge({ metric, train, test }: { metric: Metric; train: number; test: number }) {
  const gap = overfitGap(metric, train, test);
  const pct = Math.abs(gap / (train || 1)) * 100;
  const { fit, warn } = getThreshold(metric);

  if (pct < fit)  return <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">Fit ✓</span>;
  if (pct < warn) return <span className="text-xs px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800">Gap sedang</span>;
  return <span className="text-xs px-2 py-0.5 rounded-md bg-red-100 text-red-800">Overfit!</span>;
}

function MetricCard({ metric, train, test }: { metric: Metric; train: number; test: number }) {
  const max = Math.max(train, test) * 1.15 || 1;
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">{metric}</p>
      <div className="flex flex-col gap-2">
        {(["train", "test"] as const).map((split) => {
          const val = split === "train" ? train : test;
          const pct = (val / max) * 100;
          const color = split === "train" ? COLOR_TRAIN : COLOR_TEST;
          return (
            <div key={split} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-10 text-right text-gray-400">{split}</span>
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="w-10 text-gray-400">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// mode best: tampil dua model ensemble side by side
function EnsembleCompare({
  varName,
  models,
  data,
}: {
  varName: string;
  models: string[];
  data: OverfitData;
}) {
  return (
    <div className="space-y-6">
      {models.map((model) => {
        const current = data[varName]?.[model];
        if (!current) return (
          <p key={model} className="text-sm text-gray-400">{model}: data tidak tersedia.</p>
        );
        return (
          <div key={model}>
            <p className="text-sm font-semibold text-teal-700 mb-3">{model}</p>
            <div className="grid grid-cols-2 gap-3">
              {METRICS.map((m) => (
                <MetricCard key={m} metric={m} train={current.train[m]} test={current.test[m]} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {METRICS.map((m) => (
                <span key={m} className="text-xs text-gray-500">
                  {m}: <OverfitBadge metric={m} train={current.train[m]} test={current.test[m]} />
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OverfitChart({ selectedVar: selectedVarProp, mode = "general" }: OverfitChartProps) {
  const [data, setData]                           = useState<OverfitData>({});
  const [ensembleComponents, setEnsembleComponents] = useState<Record<string, string[]>>({});
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState("");
  const [selectedVar, setSelectedVar]             = useState("");
  const [selectedModel, setSelectedModel]         = useState("");
  const [selectedEnsembleModel, setSelectedEnsembleModel] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/overfit_metrics", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); return; }

        // handle both response shapes (breaking change safe)
        const metrics: OverfitData = json.metrics ?? json;
        const components: Record<string, string[]> = json.ensemble_components ?? {};

        setData(metrics);
        setEnsembleComponents(components);

        const firstVar = selectedVarProp && metrics[selectedVarProp]
          ? selectedVarProp
          : Object.keys(metrics)[0] ?? "";
        const firstModel = Object.keys(metrics[firstVar] ?? {})[0] ?? "";
        setSelectedVar(firstVar);
        setSelectedModel(firstModel);
      })
      .catch(() => setError("Gagal fetch data overfit."))
      .finally(() => setLoading(false));
  }, [selectedVarProp]);

  const vars   = Object.keys(data);
  const models = Object.keys(data[selectedVar] ?? {});
  const current = data[selectedVar]?.[selectedModel];

  // mode best: model yang dipakai ensemble untuk selectedVar
  const bestModels = ensembleComponents[selectedVar] ?? [];

  if (loading) return <div className="text-sm text-gray-400 p-6">Memuat data...</div>;
  if (error)   return <div className="text-sm text-red-400 p-6">{error}</div>;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 text-lg">Overfit Check</h3>
          <p className="text-sm text-gray-400">-- Perbandingan performa train vs test per model</p>
        </div>
        <div className="flex gap-2">
          {/* var dropdown — selalu tampil */}
          <select
            value={selectedVar}
            onChange={(e) => {
              setSelectedVar(e.target.value);
              setSelectedModel(Object.keys(data[e.target.value] ?? {})[0] ?? "");
            }}
            className="border border-gray-200 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {vars.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          {/* model dropdown — hanya general */}
          {mode === "general" && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="border border-gray-200 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_TRAIN }} />
          Train
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_TEST }} />
          Test
        </span>
      </div>

      {/* CONTENT */}
      {mode === "best" ? (
        bestModels.length > 0 ? (
          <EnsembleCompare varName={selectedVar} models={bestModels} data={data} />
        ) : (
          <p className="text-sm text-gray-400">Data ensemble belum tersedia untuk {selectedVar}.</p>
        )
      ) : (
        current ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {METRICS.map((m) => (
                <MetricCard key={m} metric={m} train={current.train[m]} test={current.test[m]} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {METRICS.map((m) => (
                <span key={m} className="text-xs text-gray-500">
                  {m}: <OverfitBadge metric={m} train={current.train[m]} test={current.test[m]} />
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400">Model belum tersedia untuk kombinasi ini.</p>
        )
      )}
    </div>
  );
}