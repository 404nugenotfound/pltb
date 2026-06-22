import { useState, useEffect, useCallback } from "react";

export interface GuideStep {
  id: number;
  icon: string;
  title: string;
  description: string;
  target?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 10;

// ─── Steps: Forecasting ────────────────────────────────────────────────
export const FORECASTING_STEPS: GuideStep[] = [
  {
    id: 0,
    icon: "👋",
    title: "Selamat Datang di Ventara!",
    description:
      "Mari ikuti tur singkat untuk memahami fitur sistem Peramalan Energi Angin dan optimasi pembebanan PLTB ini.",
  },
  {
    id: 1,
    icon: "📁",
    title: "Upload Data CSV",
    description:
      "Mulai dengan mengupload file CSV data energi kamu di sini. Drag & drop atau klik untuk memilih file.",
    target: "upload-csv",
    position: "bottom",
  },
  {
    id: 2,
    icon: "⚡",
    title: "Pilih Algoritma Machine Learning",
    description:
      "Pilih mode General untuk menjalankan semua model, atau Best 2 Model untuk menggunakan dua model terbaik secara otomatis.",
    target: "algo-selector",
    position: "bottom",
  },
  {
    id: 3,
    icon: "📊",
    title: "Lihat Performa Model",
    description:
      "Bagian ini menampilkan metrik evaluasi setiap model (MAE, RMSE, MAPE, R²). Model dengan badge #1 Best adalah yang paling akurat.",
    target: "metrics-section",
    position: "top",
  },
  {
    id: 4,
    icon: "🚀",
    title: "Generate Prediksi",
    description:
      "Klik tombol ini untuk memulai proses prediksi. Sistem akan melatih model dan menghasilkan laporan energi 7 hari ke depan.",
    target: "btn-generate",
    position: "top",
  },
  {
    id: 5,
    icon: "📥",
    title: "Download Template Dataset",
    description:
      "Belum punya data? Download template CSV di sini sebagai panduan format data yang diperlukan sistem.",
    target: "btn-download-template",
    position: "bottom",
  },
];

// ─── Steps: Analitik ───────────────────────────────────────────────────
export const ANALITIK_STEPS: GuideStep[] = [
  {
    id: 0,
    icon: "👋",
    title: "Selamat Datang di Analitik!",
    description:
      "Halaman ini menampilkan data cuaca real-time dan prakiraan angin 7 hari ke depan berdasarkan lokasi yang kamu pilih.",
  },
  {
    id: 1,
    icon: "🔍",
    title: "Cari Lokasi",
    description:
      "Ketik nama kota atau wilayah Indonesia di sini. Sistem akan menampilkan saran lokasi secara otomatis saat kamu mengetik.",
    target: "search-location",
    position: "bottom",
  },
  {
    id: 2,
    icon: "🗺️",
    title: "Peta Lokasi",
    description:
      "Setelah memilih lokasi, peta akan menampilkan titik koordinat beserta informasi rata-rata angin dan arah dominan 7 hari ke depan.",
    target: "map-area",
    position: "bottom",
  },
  {
    id: 3,
    icon: "📅",
    title: "Pilih Tampilan Data",
    description:
      "Gunakan tab Daily untuk melihat kartu cuaca per hari, atau Trends untuk melihat grafik tren suhu, kelembapan, dan kecepatan angin.",
    target: "view-tabs",
    position: "bottom",
  },
  {
    id: 4,
    icon: "🌬️",
    title: "Kartu Angin & Cuaca Harian",
    description:
      "Setiap kartu menampilkan kecepatan angin, arah, suhu, dan kondisi cuaca per hari. Geser ke kanan untuk melihat hari berikutnya.",
    target: "carousel-daily",
    position: "top",
  },
  {
    id: 5,
    icon: "📰",
    title: "Detail & Analisis NLP",
    description:
      "Klik tombol ini di kartu cuaca untuk melihat analisis mendalam — sentimen kondisi angin, rekomendasi operasional, dan highlight waspada.",
    target: "btn-detail",
    position: "top",
  },
];

// ─── Steps: Historis ───────────────────────────────────────────────────
export const HISTORIS_STEPS: GuideStep[] = [
  {
    id: 0,
    icon: "👋",
    title: "Selamat Datang di Historis!",
    description:
      "Halaman ini menyimpan semua riwayat perhitungan dan prediksi energi angin yang pernah kamu jalankan.",
  },
  {
    id: 1,
    icon: "🔎",
    title: "Cari Riwayat",
    description:
      "Ketik nama file, algoritma, atau status untuk memfilter riwayat perhitungan secara cepat.",
    target: "search-historis",
    position: "bottom",
  },
  {
    id: 2,
    icon: "💾",
    title: "Penggunaan Penyimpanan",
    description:
      "Bar ini menunjukkan kapasitas penyimpanan yang terpakai. Klik Upgrade jika kamu membutuhkan ruang lebih besar.",
    target: "storage-bar",
    position: "bottom",
  },
  {
    id: 3,
    icon: "📋",
    title: "Tabel Riwayat",
    description:
      "Semua hasil perhitungan ditampilkan di sini lengkap dengan waktu, file, algoritma, periode, dan metrik hasil prediksi.",
    target: "table-historis",
    position: "top",
  },
  {
    id: 4,
    icon: "🛠️",
    title: "Tombol Aksi",
    description:
      "Setiap baris memiliki tiga aksi: lihat laporan NLP, unduh CSV hasil prediksi, atau hapus riwayat tersebut.",
    target: "btn-aksi",
    position: "top",
  },
  {
    id: 5,
    icon: "⬆️",
    title: "Upgrade Penyimpanan",
    description:
      "Butuh ruang lebih? Klik tombol ini untuk upgrade ke paket Basic atau Business dengan kapasitas lebih besar.",
    target: "btn-upgrade",
    position: "bottom",
  },
];

// ─── Steps: Settings ───────────────────────────────────────────────────
export const SETTINGS_STEPS: GuideStep[] = [
  {
    id: 0,
    icon: "⚙️",
    title: "Selamat Datang di Settings!",
    description:
      "Di sini kamu bisa mengatur profil akun, cache sistem, dan mengelola snapshot model yang tersimpan.",
  },
  {
    id: 1,
    icon: "👤",
    title: "Edit Profile",
    description:
      "Klik tombol ini untuk mengubah foto profil, email, username, dan password akun Ventara kamu.",
    target: "edit-profile",
    position: "bottom",
  },
  {
    id: 2,
    icon: "💾",
    title: "Cache Model & Metrics",
    description:
      "Aktifkan cache agar model dan hasil evaluasi tersimpan sehingga proses berikutnya lebih cepat dan tidak perlu retrain ulang.",
    target: "cache-toggle",
    position: "bottom",
  },
  {
    id: 3,
    icon: "📦",
    title: "Kelola Snapshot",
    description:
      "Bagian ini berisi seluruh snapshot model yang pernah tersimpan dan dapat digunakan kembali kapan saja.",
    target: "snapshot-management",
    position: "top",
  },
  {
    id: 4,
    icon: "📊",
    title: "Penggunaan Slot Snapshot",
    description:
      "Lihat jumlah snapshot yang telah digunakan beserta batas slot berdasarkan paket akun yang dimiliki.",
    target: "snapshot-usage",
    position: "bottom",
  },
];

// ─── Steps: Edit Profile ───────────────────────────────────────────────
export const EDIT_PROFILE_STEPS: GuideStep[] = [
  {
    id: 0,
    icon: "✏️",
    title: "Edit Profile",
    description:
      "Di halaman ini kamu bisa mengubah foto profil, nama, email, dan password akun Ventara kamu.",
  },
  {
    id: 1,
    icon: "🖼️",
    title: "Foto Profil",
    description:
      "Klik foto atau tombol Ganti Foto untuk mengunggah gambar baru. Format yang didukung JPG/PNG.",
    target: "avatar-upload",
    position: "bottom",
  },
  {
    id: 2,
    icon: "📝",
    title: "Informasi Akun",
    description:
      "Ubah nama tampilan dan email di sini. Username tidak dapat diubah karena digunakan sebagai identitas unik akunmu.",
    target: "form-info",
    position: "bottom",
  },
  {
    id: 3,
    icon: "🔒",
    title: "Ganti Password",
    description:
      "Masukkan password saat ini lalu isi password baru minimal 4 karakter. Klik Ubah Password untuk menyimpan.",
    target: "change-password",
    position: "top",
  },
  {
    id: 4,
    icon: "💾",
    title: "Simpan Perubahan",
    description:
      "Setelah selesai mengedit nama atau email, klik tombol ini untuk menyimpan semua perubahan ke akun kamu.",
    target: "btn-save",
    position: "top",
  },
];

// ─── Steps: Overview ───────────────────────────────────────────────────
export const OVERVIEW_STEPS: GuideStep[] = [
  {
    id: 0,
    icon: "📊",
    title: "Selamat Datang di Overview!",
    description:
      "Halaman ini merangkum hasil generate prediksi energi angin — dari info dataset, laporan NLP, hingga grafik analisis.",
  },
  {
    id: 1,
    icon: "📋",
    title: "Info Hasil Generate",
    description:
      "Bagian ini menampilkan nama dataset yang dipakai, mode generate yang dipilih, dan tombol download laporan PDF.",
    target: "overview-header",
    position: "bottom",
  },
  {
    id: 2,
    icon: "📰",
    title: "Laporan NLP",
    description:
      "Hasil analisis teks otomatis dari prediksi energi angin — berisi ringkasan kondisi, rekomendasi operasional, dan highlight waspada.",
    target: "nlp-result",
    position: "bottom",
  },
  {
    id: 3,
    icon: "🗂️",
    title: "Tab Analisis",
    description:
      "Pilih tab EDA untuk eksplorasi data, Overfit Check untuk evaluasi model, atau Prediksi vs Aktual untuk melihat grafik hasil prediksi.",
    target: "analysis-tabs",
    position: "bottom",
  },
  {
    id: 4,
    icon: "📈",
    title: "Konten Analisis",
    description:
      "Area ini menampilkan grafik dan tabel sesuai tab yang dipilih. Ganti tab di atas untuk berpindah antar jenis analisis.",
    target: "tab-content",
    position: "top",
  },
];

// ─── Sync ke GuideContext via window bridge ────────────────────────────
function syncContext(open: boolean) {
  if (typeof window !== "undefined" && (window as any).__setGuideOpen) {
    (window as any).__setGuideOpen(open);
  }
}

// ─── Generic useGuide ──────────────────────────────────────────────────
interface UseGuideOptions {
  steps: GuideStep[];
  storageKey: string | null; // null = identitas user belum siap, guide ditunda
}

export function useGuide({ steps, storageKey }: UseGuideOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [showFlyAnimation, setShowFlyAnimation] = useState(false);
  const [startCoords, setStartCoords] = useState({ x: 0, y: 0 });

  const totalSteps = steps.length;
  const step = steps[currentStep];
useEffect(() => {
    if (!storageKey) return; // tunggu sampai key per-user siap
    const done = localStorage.getItem(storageKey);
    if (!done) {
      setIsOpen(true);
      syncContext(true);
    }
  }, [storageKey]);

 useEffect(() => {
  if (!isOpen) {
    setHighlightRect(null);
    return;
  }

  const target = step?.target;
  if (!target) {
    setHighlightRect(null);
    return;
  }

  const updateRect = () => {
    const el = document.querySelector(`[data-guide="${target}"]`);
    if (!el) {
      setHighlightRect(null);
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });
    }, 400);
  };

  const timer = setTimeout(updateRect, 100);
  window.addEventListener("resize", updateRect);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("resize", updateRect);
  };
}, [isOpen, currentStep, step?.target]);

  const finish = useCallback(() => {
    const finishBtn = document.getElementById("finish-guide-btn");
    if (finishBtn) {
      const rect = finishBtn.getBoundingClientRect();
      setStartCoords({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    if (storageKey) {
      localStorage.setItem(storageKey, "true");
    }
    setIsOpen(false);
    setCurrentStep(0);
    setHighlightRect(null);
    syncContext(false);
    setShowFlyAnimation(true);
  }, [storageKey]);

  const next = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      finish();
    }
  }, [currentStep, totalSteps, finish]);

  const back = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const openGuide = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
    syncContext(true);
  }, []);

  const resetFlyAnimation = useCallback(() => {
    setShowFlyAnimation(false);
  }, []);

  return {
    isOpen,
    currentStep,
    totalSteps,
    step,
    highlightRect,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
    next,
    back,
    finish,
    openGuide,
    showFlyAnimation,
    startCoords,
    resetFlyAnimation,
  };
}