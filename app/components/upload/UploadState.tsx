"use client";

import { useRef } from "react";

import LoadingState from "./LoadingState";
import NLPResult from "./NLPResult";

import { useUploadDataset } from "@/app/hooks/useUploadDataset";
import { useTrainToast } from "@/app/hooks/useTrainToast";

interface UploadStateProps {
  uiState: "idle" | "loading" | "nlp";
  datasetName: string;
  nlpReport: string;
  generateMode?: "general" | "best";
  onUiStateChange: (state: "idle" | "loading" | "nlp") => void;
  onReset?: () => void;
  onTrainingComplete?: () => void;  
}

export default function UploadState({
  uiState,
  datasetName,
  nlpReport,
  generateMode,
  onTrainingComplete, 
  onUiStateChange,
  onReset
}: UploadStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { fileName, handleFiles } = useUploadDataset();
  const train = useTrainToast();

  function onFilePicked(files: FileList | null) {
    handleFiles(
      files,
      // onTrainingStarted — status "started"
      () => train.startTrainToast(() => {
        onTrainingComplete?.();  // ✅ refresh metrics
      }),
      // onReload — status "skipped"
      () => window.location.reload()
    );
  }

  return (
    <>
      {uiState === "idle" && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFilePicked(e.dataTransfer.files); }}
          className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-20 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all"
        >
          <input
            type="file"
            hidden
            ref={fileInputRef}
            accept=".csv"
            onChange={(e) => onFilePicked(e.target.files)}
          />

          <p className="text-gray-700 font-medium">Upload Dataset CSV</p>
          <p className="text-sm text-gray-500 mt-2">Drag & drop atau klik upload</p>
          

          {datasetName && (
            <p className="text-xs text-teal-600 mt-3 font-medium">
              Dataset Aktif: {datasetName}
            </p>
          )}

          {fileName && (
            <p className="mt-4 text-sm font-medium text-gray-700">{fileName}</p>
          )}
        </div>
      )}

      {uiState === "loading" && <LoadingState />}
      {uiState === "nlp" && <NLPResult 
      nlpReport={nlpReport} 
      generateMode={generateMode} 
      onReset={onReset} />}
    </>
  );
}
