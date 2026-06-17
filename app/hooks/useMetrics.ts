"use client";
import { useState, useEffect, useCallback } from "react";

interface ModelMetrics {
  [key: string]: number | string | undefined;

  MAE?: number;
  RMSE?: number;
  sMAPE?: number;
  R2?: number;

  CircularMAE?: number;
  CircularRMSE?: number;
  CircularCorr?: number;
  Acc15?: number;

  EVS?: number;

  primary_metric?: string;
  primary_value?: number;

  MAE_pct?: number;
  CircularMAE_pct?: number;
}

interface ForecastingData {
  dataset_name: string;
  metrics: Record<string, ModelMetrics>;
  best_models: string[];
  ensemble_summary?: Record<string, any>;
  stacking_metrics: {
    xgb?: ModelMetrics;
    xgbLstm?: ModelMetrics;
    xgbBiLstm?: ModelMetrics;
  };
}

export function useMetrics(selectedVar: string = "WS10M") {
  const [data, setData] = useState<ForecastingData>({
    dataset_name: "",
    metrics: {},
    best_models: [],
    stacking_metrics: {},
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const username = sessionStorage.getItem("ventara_username") || "";
      const res = await fetch(
        `http://localhost:5000/forecasting_data?var=${selectedVar}`,
        {
          credentials: "include",
          headers: { "X-Username": username },
        }
      );
      const json = await res.json();
      if (json.error || !json.metrics) return;
      setData(json);
    } catch (e) {
      console.error("Failed to fetch metrics:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedVar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("training-complete", handler);
    return () => window.removeEventListener("training-complete", handler);
  }, [fetchData]);

  return { ...data, loading, refreshMetrics: fetchData };
}