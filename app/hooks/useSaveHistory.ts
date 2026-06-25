"use client";

import toast from "react-hot-toast";

interface SaveHistoryPayload {
  file: string;
  output_file: string;
  algo: string;
  periode: string;
  nlp_report: string;
  forecast_data?: object | null;
  metrics?: object | null;
  ensemble_components?: object | null;
  onStorageFull?: () => void;
}

export function useSaveHistory() {

  const saveHistory = async ({
    file,
    output_file,
    algo,
    periode,
    nlp_report,
    forecast_data,
    metrics,
    ensemble_components,
    onStorageFull,
  }: SaveHistoryPayload) => {

    try {
      const newItem = {
        id: Date.now(),
        waktu: new Date().toLocaleString("id-ID"),
        file,
        output_file,
        algo,
        periode,
        status: "Selesai",
        nlp_report,
        forecast_data: forecast_data ?? null,
        metrics: metrics ?? null,
        ensemble_components: ensemble_components ?? null,
      };

      const username = sessionStorage.getItem("ventara_username");
      const res = await fetch("http://localhost:5000/save_history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Username": username || "",
        },
        credentials: "include",
        body: JSON.stringify({ entry: newItem }),
      });

      const json = await res.json();

      if (res.status === 403 && json.storage_full) {
        toast.error("Storage penuh! Upgrade tier untuk menyimpan lebih banyak.");
        onStorageFull?.();  // ← trigger modal
        return;
      }

      if (json.success) {
        toast.success("Data berhasil disimpan ke historis");
      } else {
        toast.error(json.message || "Gagal menyimpan.");
      }

    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan data historis");
    }
  };

  return { saveHistory };
}