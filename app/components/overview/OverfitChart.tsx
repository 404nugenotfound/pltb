"use client";

import { useState, useEffect, useRef } from "react";

const ALL_METRICS = [
  "MAE",
  "RMSE",
  "sMAPE",
  "R2",
  "CircularMAE",
  "MAE_pct",
  "CircularMAE_pct",
] as const;
type Metric = (typeof ALL_METRICS)[number];

interface ModelMetrics {
  train: Record<string, number>;
  test: Record<string, number>;
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
const COLOR_TEST = "#3b82f6";

const EXCLUDE_KEYS = new Set([
  "primary_metric",
  "primary_value",
  "MAE_pct",
  "CircularMAE_pct",
]);

const VAR_ORDER = ["WS10M", "WD10M", "T2M", "RH2M", "PS"];

function overfitGap(metric: string, train: number, test: number) {
  return metric === "R2" ? train - test : test - train;
}

function getThreshold(metric: string) {
  if (metric === "R2") return { fit: 5, warn: 10 };
  if (
    metric === "sMAPE" ||
    metric === "MAE_pct" ||
    metric === "CircularMAE_pct"
  )
    return { fit: 20, warn: 40 };
  return { fit: 15, warn: 25 };
}

function OverfitBadge({
  metric,
  train,
  test,
}: {
  metric: string;
  train: number;
  test: number;
}) {
  const gap = overfitGap(metric, train, test);
  const pct = Math.abs(gap / (train || 1)) * 100;
  const { fit, warn } = getThreshold(metric);

  if (pct < fit)
    return (
      <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
        Fit ✓
      </span>
    );
  if (pct < warn)
    return (
      <span className="text-xs px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800">
        Gap sedang
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded-md bg-red-100 text-red-800">
      Overfit!
    </span>
  );
}

function MetricCard({
  metric,
  train,
  test,
}: {
  metric: string;
  train: number;
  test: number;
}) {
  const max = Math.max(train, test) * 1.15 || 1;
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        {metric}
      </p>
      <div className="flex flex-col gap-2">
        {(["train", "test"] as const).map((split) => {
          const val = split === "train" ? train : test;
          const pct = (val / max) * 100;
          const color = split === "train" ? COLOR_TRAIN : COLOR_TEST;
          return (
            <div
              key={split}
              className="flex items-center gap-2 text-xs text-gray-500"
            >
              <span className="w-10 text-right text-gray-400">{split}</span>
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="w-10 text-gray-400">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricGrid({ modelData }: { modelData: ModelMetrics }) {
  const metrics = Object.keys(modelData.train).filter(
    (m) => !EXCLUDE_KEYS.has(m),
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <MetricCard
            key={m}
            metric={m}
            train={modelData.train[m] ?? 0}
            test={modelData.test[m] ?? 0}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {metrics.map((m) => (
          <span key={m} className="text-xs text-gray-500">
            {m}:{" "}
            <OverfitBadge
              metric={m}
              train={modelData.train[m] ?? 0}
              test={modelData.test[m] ?? 0}
            />
          </span>
        ))}
      </div>
    </>
  );
}

function EnsembleCompare({
  varName,
  ensembleKey,
  data,
}: {
  varName: string;
  ensembleKey: string;
  data: OverfitData;
}) {
  const current = data[varName]?.[ensembleKey];
  if (!current)
    return (
      <p className="text-sm text-gray-400">
        Data ensemble belum tersedia untuk {varName}.
      </p>
    );
  return (
    <div>
      <p className="text-sm font-semibold text-teal-700 mb-3">
        {ensembleKey.replace("+", " + ")}
      </p>
      <MetricGrid modelData={current} />
    </div>
  );
}

export default function OverfitChart({
  selectedVar: selectedVarProp,
  mode = "general",
}: OverfitChartProps) {
  const [data, setData] = useState<OverfitData>({});
  const [ensembleComponents, setEnsembleComponents] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVar, setSelectedVar] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  // ✅ memory: ingat model yang dipilih per-var, tidak reset saat ganti var
  const modelMemory = useRef<Record<string, string>>({});

  const setSelectedModelWithMemory = (varName: string, model: string) => {
    modelMemory.current[varName] = model;
    setSelectedModel(model);
  };

  useEffect(() => {
    const username = sessionStorage.getItem("ventara_username");
    const cached = sessionStorage.getItem(
      `ventara_overfit_metrics_${username}`,
    );
    const cachedComponents = sessionStorage.getItem(
      `ventara_ensemble_components_${username}`,
    );

    if (cached) {
      try {
        const metrics = JSON.parse(cached);
        const components = cachedComponents ? JSON.parse(cachedComponents) : {};
        // sama seperti handler fetch
        setData(metrics);
        setEnsembleComponents(components);
        const firstVar =
          selectedVarProp && metrics[selectedVarProp]
            ? selectedVarProp
            : (VAR_ORDER.find((v) => metrics[v]) ??
              Object.keys(metrics)[0] ??
              "");
        const firstModel =
          modelMemory.current[firstVar] ??
          Object.keys(metrics[firstVar] ?? {}).find((m) => !m.includes("+")) ??
          "";
        setSelectedVar(firstVar);
        setSelectedModelWithMemory(firstVar, firstModel);
        setLoading(false);
        return;
      } catch {}
    }

    fetch("http://localhost:5000/overfit_metrics", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          return;
        }

        const metrics: OverfitData = json.metrics ?? json;
        const components: Record<string, string[]> =
          json.ensemble_components ?? {};

        setData(metrics);
        setEnsembleComponents(components);

        const firstVar =
          selectedVarProp && metrics[selectedVarProp]
            ? selectedVarProp
            : (VAR_ORDER.find((v) => metrics[v]) ??
              Object.keys(metrics)[0] ??
              "");

        // ✅ filter ensemble key dari default model
        const firstModel =
          modelMemory.current[firstVar] ??
          Object.keys(metrics[firstVar] ?? {}).find((m) => !m.includes("+")) ??
          "";

        setSelectedVar(firstVar);
        setSelectedModelWithMemory(firstVar, firstModel);
      })
      .catch(() => setError("Gagal fetch data overfit."))
      .finally(() => setLoading(false));
  }, [selectedVarProp]);

  const vars = Object.keys(data).sort(
    (a, b) => VAR_ORDER.indexOf(a) - VAR_ORDER.indexOf(b),
  );

  // ✅ filter ensemble key dari dropdown model general
  const models = Object.keys(data[selectedVar] ?? {}).filter(
    (m) => !m.includes("+"),
  );

  const current = data[selectedVar]?.[selectedModel];

  // ✅ displayMetrics dinamis dari data aktual (handle WD10M circular metrics)
  const displayMetrics = current
    ? Object.keys(current.train).filter((m) => !EXCLUDE_KEYS.has(m))
    : ["MAE", "RMSE", "sMAPE", "R2"];

  // ensemble key untuk mode best
  const ensembleKey = (() => {
    const components = ensembleComponents[selectedVar];
    if (!components || components.length < 2) return null;
    const key = components.join("+");
    return data[selectedVar]?.[key] ? key : null;
  })();

  if (loading)
    return <div className="text-sm text-gray-400 p-6">Memuat data...</div>;
  if (error) return <div className="text-sm text-red-400 p-6">{error}</div>;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 text-lg">Overfit Check</h3>
          <p className="text-sm text-gray-400">
            -- Perbandingan performa train vs test per model
          </p>
        </div>
        <div className="flex gap-2">
          {/* var dropdown — selalu tampil */}
          <select
            value={selectedVar}
            onChange={(e) => {
              const newVar = e.target.value;
              setSelectedVar(newVar);
              const nonEnsemble = Object.keys(data[newVar] ?? {}).filter(
                (m) => !m.includes("+"),
              );
              // ✅ hanya pakai memory kalau user pernah pilih (bukan dari pre-fill)
              const remembered = modelMemory.current[newVar];
              const fallback = nonEnsemble[0] ?? "";
              setSelectedModelWithMemory(newVar, remembered ?? fallback);
            }}
            className="border border-gray-200 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {vars.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* model dropdown — hanya general, tanpa ensemble key */}
          {mode === "general" && (
            <select
              value={selectedModel}
              onChange={(e) =>
                setSelectedModelWithMemory(selectedVar, e.target.value)
              }
              className="border border-gray-200 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: COLOR_TRAIN }}
          />
          Train
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: COLOR_TEST }}
          />
          Test
        </span>
      </div>

      {/* CONTENT */}
      {mode === "best" ? (
        ensembleKey ? (
          <EnsembleCompare
            varName={selectedVar}
            ensembleKey={ensembleKey}
            data={data}
          />
        ) : (
          <p className="text-sm text-gray-400">
            Data ensemble belum tersedia untuk {selectedVar}.
          </p>
        )
      ) : current ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {displayMetrics.map((m) => (
              <MetricCard
                key={m}
                metric={m}
                train={current.train[m] ?? 0}
                test={current.test[m] ?? 0}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {displayMetrics.map((m) => (
              <span key={m} className="text-xs text-gray-500">
                {m}:{" "}
                <OverfitBadge
                  metric={m}
                  train={current.train[m] ?? 0}
                  test={current.test[m] ?? 0}
                />
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400">
          Model belum tersedia untuk kombinasi ini.
        </p>
      )}
    </div>
  );
}
