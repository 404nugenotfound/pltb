const SKIP_KEYS = new Set(["primary_metric", "primary_value", "MAE_pct", "CircularMAE_pct"]);

const LABEL_MAP: Record<string, string> = {
  MAE:          "MAE",
  RMSE:         "RMSE",
  R2:           "R²",
  sMAPE:        "sMAPE",
  CircularMAE:  "CircularMAE",
  CircularRMSE: "CircularRMSE",
  CircularCorr: "Circular Corr",
  Acc15:        "Acc ±15°",
  EVS:          "EVS",
};

const FORMAT_MAP: Record<string, (v: number) => string> = {
  sMAPE:        (v) => `${v}%`,
  CircularMAE:  (v) => `${v}°`,
  CircularRMSE: (v) => `${v}°`,
  CircularCorr: (v) => `${v}`,
  Acc15:        (v) => `${v}%`,
  EVS:          (v) => `${v}`,
};

const VAR_UNIT: Record<string, string> = {
  WS10M: "m/s",
  WD10M: "°",
  RH2M:  "%",
  T2M:   "°C",
  PS:    "kPa",
};

interface MetricItem {
  MAE?: number;
  RMSE?: number;
  sMAPE?: number;
  R2?: number;
  primary_metric?: string;
  primary_value?: number;
  CircularMAE?: number;
  CircularRMSE?: number;
  CircularCorr?: number;
  Acc15?: number;
  EVS?: number;
  MAE_pct?: number;
  CircularMAE_pct?: number;
  [key: string]: number | string | undefined;
}

interface EnsembleVar {
  ml: string;
  dl: string;
  ensemble: string;
  metrics?: MetricItem;
}

interface MetricsSectionProps {
  metrics: Record<string, MetricItem>;
  selectedModel: string;
  bestModels: string[];
  selectedVar?: string; 
  stackingMetrics?: {
    xgb?: MetricItem;
    Lstm?: MetricItem;
    biLstm?: MetricItem;
    xgbLstm?: MetricItem;
    xgbBiLstm?: MetricItem;
  };
  ensembleSummary?: Record<string, EnsembleVar>;
}

function MetricRows({ m, isBest = false, unit = "" }: { 
  m: MetricItem; 
  isBest?: boolean;
  unit?: string;
}) {
  const UNIT_KEYS = new Set(["MAE", "RMSE", "CircularMAE", "CircularRMSE"]);
  
   return (
    <div className="space-y-1.5 text-xs text-gray-600">
      {Object.entries(m)
        .filter(([key]) => !SKIP_KEYS.has(key))
        .map(([key, val]) => {
          if (val === undefined || val === null) return null;
          const label = LABEL_MAP[key] ?? key;
          const formatted = FORMAT_MAP[key]
            ? FORMAT_MAP[key](val as number)
            : UNIT_KEYS.has(key) && unit
              ? `${val} ${unit}`
              : String(val);
          const isPrimary = key === m.primary_metric;
          return (
            <div key={key} className="flex justify-between">
              <span>{label}</span>
              <span className={`font-semibold ${
                isPrimary
                  ? isBest ? "text-amber-600" : "text-teal-600"
                  : "text-gray-800"
              }`}>
                {formatted}
              </span>
            </div>
          );
        })}
    </div>
  );
}

export default function MetricsSection({
  metrics,
  selectedModel,
  bestModels,
  selectedVar,
  stackingMetrics = {},
  ensembleSummary = {},
}: MetricsSectionProps) {

  const currentUnit = selectedVar
    ? VAR_UNIT[selectedVar] ?? ""
    : "";

  // ========================
  // BEST 2 MODEL VIEW
  // ========================
  if (selectedModel === "best") {
    const hasEnsemble = Object.keys(ensembleSummary).length > 0;

    if (hasEnsemble) {
      return (
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3 text-sm">
            Ensemble Forecasting yang Digunakan
          </h4>
          <div className="flex flex-col gap-3">
            {Object.entries(ensembleSummary).map(([variable, data]) => (
              <div
                key={variable}
                className="border border-amber-200 rounded-xl p-4 bg-amber-50"
              >
                <p className="text-xs font-semibold text-amber-600 mb-3 tracking-wide uppercase">
                  {variable}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-white border border-amber-200 rounded-lg px-1 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-1">Best ML</p>
                    <p className="font-bold text-sm text-teal-700">{data.ml}</p>
                  </div>
                  <span className="text-amber-400 font-bold text-lg">+</span>
                  <div className="flex-1 bg-white border border-amber-200 rounded-lg px-1 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-1">Best DL</p>
                    <p className="font-bold text-sm text-teal-700">{data.dl}</p>
                  </div>
                  <span className="text-amber-400 font-bold text-lg">→</span>
                  <div className="flex-1 bg-amber-100 border border-amber-300 rounded-lg px-1 py-2 text-center">
                    <p className="text-xs text-gray-400 mb-1">Ensemble</p>
                    <p className="font-bold text-sm text-amber-700">{data.ensemble}</p>
                  </div>
                  {data.metrics?.primary_metric !== undefined && (
                    <>
                      <span className="text-gray-300 font-bold text-lg">|</span>
                      <div className="text-center min-w-15">
                        <p className="text-xs text-gray-400 mb-1">
                          {data.metrics.primary_metric}
                        </p>
                        <p className="font-bold text-sm text-gray-700">
                          {data.metrics.primary_value}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Fallback
    const bestCards = [
      { label: "XGB",        data: stackingMetrics.xgb      ?? metrics["XGB"] },
      { label: "LSTM",       data: stackingMetrics.Lstm      ?? metrics["LSTM"] },
      { label: "Bi-LSTM",    data: stackingMetrics.biLstm    ?? metrics["BiLSTM"] },
      { label: "XGB + LSTM", data: stackingMetrics.xgbLstm },
      { label: "XGB + BiLSTM", data: stackingMetrics.xgbBiLstm },
    ];

    return (
      <div className="mb-6">
        <h4 className="font-medium text-gray-700 mb-3 text-sm cursor-default">
          Model Ensemble yang Digunakan
        </h4>
        <div className="grid grid-cols-3 gap-4">
          {bestCards.map(({ label, data }) => {
            if (!data) return null;
            return (
              <div key={label} className="border rounded-xl p-4 bg-amber-50 border-amber-300">
                <p className="font-bold text-base text-amber-700 mb-3">{label}</p>
                <MetricRows
                  m={data}
                  isBest
                  unit={currentUnit}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ========================
  // GENERAL VIEW
  // ========================
  const orderedMetrics = ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"];

  return (
    <div className="mb-6">
      <h4 className="font-medium text-gray-700 mb-3 text-sm cursor-default">
        Model Ensemble yang Digunakan
      </h4>
      <div className="grid grid-cols-3 gap-4 cursor-default">
        {orderedMetrics.slice(0, 3).map((model) => {
          const m = metrics[model];
          if (!m) return null;
          const isBest = bestModels.includes(model);
          return (
            <div
              key={model}
              className={`border rounded-xl p-4 transition-all ${
                !isBest ? "opacity-30 grayscale" : ""
              } ${isBest ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}
            >
              <p className={`font-bold text-base mb-3 ${isBest ? "text-amber-700" : "text-teal-700"}`}>
                {model}
              </p>
              <MetricRows
                  m={m}
                  isBest={isBest}
                  unit={currentUnit}
                />
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 mt-4 cursor-default">
        {orderedMetrics.slice(3).map((model) => {
          const m = metrics[model];
          if (!m) return null;
          const isBest = bestModels.includes(model);
          return (
            <div
              key={model}
              className={`w-full md:w-1/3 border rounded-xl p-4 transition-all ${
                !isBest ? "opacity-30 grayscale" : ""
              } ${isBest ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"}`}
            >
              <p className={`font-bold text-base mb-3 ${isBest ? "text-amber-700" : "text-teal-700"}`}>
                {model}
              </p>
              <MetricRows
                  m={m}
                  isBest={isBest}
                  unit={currentUnit}
                />
            </div>
          );
        })}
      </div>
    </div>
  );
}