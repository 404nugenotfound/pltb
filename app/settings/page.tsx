"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import { useStorage } from "@/app/context/StorageContext";

const DEFAULT_AVATAR = "/icon/default-avatar-profile.jpg";

export default function SettingsPage() {
  const router = useRouter();
  const { storageInfo } = useStorage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [avatarError, setAvatarError] = useState(false);

  const [cacheSize] = useState("128 MB");
  const [modelCache, setModelCache] = useState(true);
  const [metricsCache, setMetricsCache] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    setName(sessionStorage.getItem("ventara_name") || "");
    setEmail(sessionStorage.getItem("ventara_email") || "");
    setAvatar(sessionStorage.getItem("ventara_avatar") || DEFAULT_AVATAR);
  }, []);

  useEffect(() => {
    async function loadCacheSettings() {
      try {
        const res = await fetch("/api/cache-settings");
        const data = await res.json();

        setModelCache(data.model_cache);
        setMetricsCache(data.metrics_cache);
      } catch (err) {
        console.error("Failed load cache settings", err);
      }
    }

    loadCacheSettings();
  }, []);

  async function updateCacheSetting(
    key: "model_cache" | "metrics_cache",
    value: boolean,
  ) {
    try {
      const res = await fetch("/api/cache-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [key]: value,
        }),
      });

      const data = await res.json();

      console.log("saved", data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClearCache() {
    setClearingCache(true);
    await new Promise((r) => setTimeout(r, 1200));
    setClearingCache(false);
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  }

  const displayAvatar = avatarError || !avatar ? DEFAULT_AVATAR : avatar;

  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Header />

        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Settings</h2>

            {/* ── EDIT PROFILE ── */}
            <section className="mb-10 px-6">
              <h3 className="text-base font-bold text-gray-800 mb-5">
                Edit Profile
              </h3>

              <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
                {/* Manage Profile */}
                <div className="flex items-center justify-between py-4 px-6">
                  <div>
                    <p className="text-sm text-gray-700">Manage Profile</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tampilan foto profil, email, username, dan password
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/settings/edit-profile")}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Profile
                  </button>
                </div>
              </div>
            </section>

            {/* ── MANAGE CACHE ── */}
            <section className="px-6">
              <h3 className="text-base font-bold text-gray-800 mb-5">
                Manage Cache
              </h3>

              <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
                {/* Cache size */}
                <div className="flex items-center justify-between py-4 px-6">
                  <div>
                    <p className="text-sm text-gray-700">Cache Tersimpan</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Total cache model dan metrics yang telah tersimpan
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-lg">
                    {cacheCleared
                      ? "0 MB"
                      : `${storageInfo.usage_mb.toFixed(2)} MB`}
                  </span>
                </div>

                {/* Model cache toggle */}
                <div className="flex items-center justify-between py-4 px-6">
                  <div>
                    <p className="text-sm text-gray-700">Cache Model</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Simpan model terlatih agar tidak perlu retrain ulang
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const newValue = !modelCache;

                      setModelCache(newValue);

                      await updateCacheSetting("model_cache", newValue);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${modelCache ? "bg-teal-500" : "bg-gray-300"}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${modelCache ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                {/* Metrics cache toggle */}
                <div className="flex items-center justify-between py-4 px-6">
                  <div>
                    <p className="text-sm text-gray-700">Cache Metrics</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Simpan hasil perhitungan MAE, RMSE, MAPE agar lebih cepat
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const newValue = !metricsCache;

                      setMetricsCache(newValue);

                      await updateCacheSetting("metrics_cache", newValue);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${metricsCache ? "bg-teal-500" : "bg-gray-300"}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${metricsCache ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
