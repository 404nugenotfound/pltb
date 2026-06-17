"use client";

import { useRef } from "react";
import LoadingState from "./LoadingState";
import NLPResult from "./NLPResult";
import SnapshotFullModal from "./Snapshotfullmodal";
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
  onReset,
}: UploadStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    fileName,
    isUploading,
    handleFiles,
    snapshotFull,
    continueWithoutSnapshot,
    dismissSnapshotFull,
  } = useUploadDataset();

  const train = useTrainToast();

  function onFilePicked(files: FileList | null) {
    handleFiles(
      files,
      // onTrainingStarted — status "started"
      () =>
        train.startTrainToast(() => {
          onTrainingComplete?.();
        }),
      // onReload — status "skipped"
      () => window.location.reload()
    );
  }

  return (
    <>
      {/* Modal snapshot penuh — render di atas segalanya */}
      <SnapshotFullModal
        visible={snapshotFull.visible}
        snapshotCount={snapshotFull.snapshotCount}
        snapshotLimit={snapshotFull.snapshotLimit}
        tier={snapshotFull.tier}
        pendingFilename={snapshotFull.pendingFilename}
        onContinueWithoutSnapshot={() =>
          continueWithoutSnapshot(() =>
            train.startTrainToast(() => {
              onTrainingComplete?.();
            })
          )
        }
        onDismiss={dismissSnapshotFull}
      />

      {uiState === "idle" && (
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFilePicked(e.dataTransfer.files);
          }}
          className={`bg-white border-2 border-dashed rounded-2xl p-20 text-center transition-all
            ${isUploading
              ? "border-teal-300 bg-teal-50 cursor-wait"
              : "border-gray-300 cursor-pointer hover:border-teal-500 hover:bg-teal-50"
            }`}
        >
          <input
            type="file"
            hidden
            ref={fileInputRef}
            accept=".csv"
            onChange={(e) => onFilePicked(e.target.files)}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-6 h-6 text-teal-500 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <p className="text-sm text-teal-600 font-medium">Mengupload...</p>
            </div>
          ) : (
            <>
              <p className="text-gray-700 font-medium">Upload Dataset CSV</p>
              <p className="text-sm text-gray-500 mt-2">Drag & drop atau klik upload</p>
            </>
          )}

          {datasetName && !isUploading && (
            <p className="text-xs text-teal-600 mt-3 font-medium">
              Dataset Aktif: {datasetName}
            </p>
          )}

          {fileName && !isUploading && (
            <p className="mt-4 text-sm font-medium text-gray-700">{fileName}</p>
          )}
        </div>
      )}

      {uiState === "loading" && <LoadingState />}

      {uiState === "nlp" && (
        <NLPResult
          nlpReport={nlpReport}
          generateMode={generateMode}
          onReset={onReset}
        />
      )}
    </>
  );
}