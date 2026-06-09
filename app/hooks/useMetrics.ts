"use client";
import { useState, useEffect, useCallback } from "react";

interface ModelMetrics {
  MAE: number;
  RMSE: number;
  sMAPE: number;
  R2: number;
}

interface ForecastingData {
  dataset_name: string;
  metrics: Record<string, ModelMetrics>;
  best_models: string[];
  stacking_metrics: {          // ← tambah
    xgb?: ModelMetrics;
    xgbLstm?: ModelMetrics;
    xgbBiLstm?: ModelMetrics;
  };
}

export function useMetrics(selectedVar: string = "WS10M") {  // ← tambah param
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
      const res = await fetch(`/api/forecasting-data?username=${username}&var=${selectedVar}`);  // ← tambah &var
      const json = await res.json();
      if (json.error || !json.metrics) return;  // ← tambah guard
      setData(json);
    } catch (e) {
      console.error("Failed to fetch metrics:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedVar]);  // ← selectedVar jadi dependency

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