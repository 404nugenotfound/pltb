"use client";

import dynamic from "next/dynamic";

import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";

import OverviewHeader from "@/app/components/overview/OverviewHeader";
import NLPResult from "@/app/components/upload/NLPResult";
import { useEffect, useState } from "react";
import { useMetrics } from "@/app/hooks/useMetrics";

const ForecastChart = dynamic(
  () => import("@/app/components/overview/ForecastChart"),
  { ssr: false },
);


const OverfitChart = dynamic(
  () => import("@/app/components/overview/OverfitChart"),
  { ssr: false },
);

export default function OverviewPage() {
  const [nlpReport, setNlpReport] = useState("");
  const [generateMode, setGenerateMode] = useState<"general" | "best">(
    "general",
  );
  const [activeVar, setActiveVar] = useState("WS10M");
  const { dataset_name } = useMetrics();

  useEffect(() => {
    const username = sessionStorage.getItem("ventara_username");

    // cek sessionStorage dulu (dari history page)
    const savedReport = sessionStorage.getItem(
      `ventara_nlp_report_${username}`,
    );
    const savedMode = sessionStorage.getItem(
      `ventara_generate_mode_${username}`,
    );
    const savedVar = sessionStorage.getItem(
      `ventara_active_var_${username}`,
    );
    if (savedReport) setNlpReport(savedReport);
    if (savedMode) setGenerateMode(savedMode as "general" | "best");
    if (savedVar) setActiveVar(savedVar);

    fetch("http://localhost:5000/overview_data", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.nlp_report) setNlpReport(data.nlp_report);
        if (data.generate_mode) setGenerateMode(data.generate_mode);
      })
      .catch(() => {});
  }, []);

  // dummy data
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const actualData = [
    3, 4, 5, 6, 4, 5, 6, 7, 6, 5, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 4, 5, 6, 5,
  ];

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveHistory = async () => {
    setSaving(true);
    try {
      const username = sessionStorage.getItem("ventara_username");
      const res = await fetch("/api/save-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (res.ok) setSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const datasets = {
    GBR: actualData.map((v) => v + Math.random()),
    XGB: actualData.map((v) => v + Math.random()),
    KNN: actualData.map((v) => v + Math.random()),
    LSTM: actualData.map((v) => v + Math.random()),
    BiLSTM: actualData.map((v) => v + Math.random()),
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* SIDEBAR */}
      <Sidebar />

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        {/* HEADER */}
        <Header />

        {/* CONTENT */}
        <div className="p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <OverviewHeader
              datasetName={dataset_name}
              generateMode={generateMode}
              nlpReport={nlpReport}
            />
            <OverfitChart selectedVar={generateMode === "general" ? activeVar : undefined} />

            <NLPResult
              nlpReport={nlpReport}
              generateMode={generateMode}
              onReset={() => setNlpReport("")}
              hideActions
            />

            <ForecastChart
              labels={labels}
              actualData={actualData}
              datasets={datasets}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
