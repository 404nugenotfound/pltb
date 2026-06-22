"use client";

import { useState } from "react";
import { uploadDataset } from "@/app/lib/api";

export function useUploadDataset() {
  const [fileName, setFileName]     = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [snapshotFull, setSnapshotFull] = useState<{
    visible: boolean;
    snapshotCount: number;
    snapshotLimit: number;
    tier: string;
    pendingFilename: string; // filename yang udah ke-save di server
  }>({
    visible: false,
    snapshotCount: 0,
    snapshotLimit: 0,
    tier: "free",
    pendingFilename: "",
  });

  const handleFiles = async (
    files: FileList | null,
    onTrainingStarted?: () => void,
    onReload?: () => void
  ) => {
    if (!files || files.length === 0) {
      setFileName("❌ Tidak ada file dipilih");
      return;
    }

    const file = files[0];

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileName("❌ File harus format CSV");
      return;
    }

    setFileName(`📄 ${file.name}`);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("dataset", file);

      const data = await uploadDataset(formData);

      if (data.status === "skipped") {
        setFileName(`✅ ${data.filename} sudah pernah di-train (${data.trained_at}). Model langsung dimuat.`);
        setTimeout(() => onReload?.(), 2000);
        return;
      }

      if (data.status === "started" || data.status === "valid") {
        setFileName(`✅ ${data.filename} berhasil diupload. Training dimulai...`);
        onTrainingStarted?.();
        return;
      }

      // ← BARU: slot snapshot penuh
      if (data.status === "snapshot_full") {
        setSnapshotFull({
          visible: true,
          snapshotCount: data.snapshot_count,
          snapshotLimit: data.snapshot_limit,
          tier: data.tier,
          pendingFilename: data.filename ?? file.name.replace(/\s+/g, "_"),
        });
        setFileName("");
        return;
      }

      if (data.status === "invalid") {
        setFileName("❌ " + (data.errors ?? []).join(", "));
      }

    } catch (err: unknown) {
      const e = err as { errors?: string[]; message?: string };
      if (e.errors) setFileName("❌ " + e.errors.join(", "));
      else if (e.message) setFileName("❌ " + e.message);
      else setFileName("❌ Upload gagal");
    } finally {
      setIsUploading(false);
    }
  };

  // Dipanggil waktu user pilih "Lanjut Tanpa Snapshot"
  const continueWithoutSnapshot = async (
    onTrainingStarted?: () => void
  ) => {
    const { pendingFilename } = snapshotFull;
    if (!pendingFilename) return;

    setIsUploading(true);
    dismissSnapshotFull();

    try {
      const formData = new FormData();
      formData.append("skip_snapshot", "true");

      // File udah ada di server, cukup kasih tau filename-nya
      // BE cukup baca dari UPLOAD_FOLDER/pendingFilename
      formData.append("filename", pendingFilename);

      const data = await uploadDataset(formData);

      if (data.status === "started") {
        setFileName(`✅ ${pendingFilename} diupload. Training dimulai tanpa snapshot...`);
        onTrainingStarted?.();
      }
    } catch {
      setFileName("❌ Gagal melanjutkan training");
    } finally {
      setIsUploading(false);
    }
  };

  const dismissSnapshotFull = () =>
    setSnapshotFull((prev) => ({ ...prev, visible: false }));

  const resetDataset = () => setFileName("");

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Dipanggil waktu user pilih "Upgrade Paket" di SnapshotFullModal
  const openUpgradeModal = () => {
    setSnapshotFull((prev) => ({ ...prev, visible: false })); // sembunyiin modal lama, data (pendingFilename) tetep kesimpen
    setShowUpgradeModal(true);
  };

  const closeUpgradeModal = () => setShowUpgradeModal(false);

  // Dipanggil dari UpgradeModal.onSuccess
  const retryAfterUpgrade = async (onTrainingStarted?: () => void) => {
    const { pendingFilename } = snapshotFull;
    if (!pendingFilename) return;

    setIsUploading(true);
    setShowUpgradeModal(false);

    try {
      const formData = new FormData();
      formData.append("filename", pendingFilename);
      // sengaja TANPA skip_snapshot — biar backend create snapshot baru

      const data = await uploadDataset(formData);

      if (data.status === "started") {
        setFileName(`✅ ${pendingFilename} diupload. Training dimulai dengan snapshot baru...`);
        onTrainingStarted?.();
        return;
      }

      // edge case: upgrade kepanggil tapi limit di BE belum ke-refresh / race condition
      if (data.status === "snapshot_full") {
        setSnapshotFull({
          visible: true,
          snapshotCount: data.snapshot_count,
          snapshotLimit: data.snapshot_limit,
          tier: data.tier,
          pendingFilename: data.filename ?? pendingFilename,
        });
      }
    } catch {
      setFileName("❌ Gagal melanjutkan training setelah upgrade");
    } finally {
      setIsUploading(false);
    }
  };

  return {
    fileName,
    isUploading,
    handleFiles,
    resetDataset,
    snapshotFull,
    continueWithoutSnapshot,
    dismissSnapshotFull,
    showUpgradeModal,        // ← tambah ini
    openUpgradeModal,        // ← tambah ini
    closeUpgradeModal,       // ← tambah ini
    retryAfterUpgrade, 
  };
}