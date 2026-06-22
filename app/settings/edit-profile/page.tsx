"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";

import { useGuide, EDIT_PROFILE_STEPS } from "@/app/hooks/Useguide";
import { GuideModal, GuideOverlay, GuideButton } from "@/app/components/guide";

const DEFAULT_AVATAR = "/icon/default-avatar-profile.jpg";

const EDIT_PROFILE_STORAGE_KEY = "ventara_guide_edit_profile_done";

export default function EditProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [avatarError, setAvatarError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [avatarFile, setAvatarFile] = useState<string | null>(null);

  const {
    isOpen: guideOpen,
    currentStep,
    totalSteps,
    step,
    highlightRect,
    isFirstStep,
    isLastStep,
    next,
    back,
    finish,
    openGuide,
    showFlyAnimation,
    startCoords,
    resetFlyAnimation,
  } = useGuide({
    steps: EDIT_PROFILE_STEPS,
    storageKey: EDIT_PROFILE_STORAGE_KEY,
  });

  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    setUsername(sessionStorage.getItem("ventara_username") || "");
    setName(sessionStorage.getItem("ventara_name") || "");
    setEmail(sessionStorage.getItem("ventara_email") || "");
    setAvatar(sessionStorage.getItem("ventara_avatar") || DEFAULT_AVATAR);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("http://localhost:5000/update_profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          name,
          email,
          avatar: avatarFile ?? undefined, // ✅ kirim kalau ada perubahan
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message, "error");
        return;
      }
      sessionStorage.setItem("ventara_name", data.name);
      sessionStorage.setItem("ventara_email", data.email);
      if (avatarFile) {
        sessionStorage.setItem("ventara_avatar", avatarFile); // ✅ simpan ke session setelah berhasil
        setAvatarFile(null);
      }
      showToast("Profil berhasil disimpan!", "success");
      setTimeout(() => router.push("/settings"), 1500);
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Semua field password harus diisi.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Password baru tidak cocok.", "error");
      return;
    }
    if (newPassword.length < 4) {
      showToast("Password minimal 4 karakter.", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("http://localhost:5000/change_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message, "error");
        return;
      }
      showToast("Password berhasil diubah!", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatar(result); // preview langsung
      setAvatarError(false);
      setAvatarFile(result); // ✅ simpan ke state, belum kirim ke server
    };
    reader.readAsDataURL(file);
  }

  const displayAvatar = avatarError || !avatar ? DEFAULT_AVATAR : avatar;

  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Header />

        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            {/* BACK BUTTON */}
            <button
              onClick={() => router.push("/settings")}
              className="flex items-center gap-2 text-md italic text-gray-500 hover:text-gray-900 mb-6 transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Kembali ke Settings
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-6 ml-8 cursor-default">
              Edit Profile
            </h2>

            {/* AVATAR */}
            <div className="flex items-center gap-10 mb-8 max-w-4xl px-14 py-5 ml-12 bg-white border border-gray-100 rounded-xl">
              <div
                data-guide="avatar-upload"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity shrink-0"
              >
                <img
                  src={displayAvatar}
                  className="w-full h-full object-cover border-2 border-teal-500 rounded-full"
                  alt=""
                  onError={() => setAvatarError(true)}
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
              />
              <div className="cursor-default">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Foto Profil
                </p>
                <p className="text-xs text-gray-400">
                  Klik foto untuk mengganti foto profil pengguna
                </p>
              </div>
              <div className="ml-63">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Ganti Foto
                </button>
              </div>
            </div>

            {/* FORM */}
            <div
              className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 max-w-4xl ml-12"
              data-guide="form-info"
            >
              {/* Nama */}
              <div className="flex items-center justify-between py-4 px-12">
                <div className="cursor-default">
                  <p className="text-sm text-gray-700">Nama</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Nama yang ditampilkan di aplikasi
                  </p>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-52"
                />
              </div>

              {/* Email */}
              <div className="flex items-center justify-between py-4 px-12">
                <div className="cursor-default">
                  <p className="text-sm text-gray-700">Email</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Email akun Anda
                  </p>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-52"
                />
              </div>

              {/* Username (readonly) */}
              <div className="flex items-center justify-between py-4 px-12">
                <div className="cursor-default">
                  <p className="text-sm text-gray-700">Username</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Username tidak dapat diubah
                  </p>
                </div>
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-100 cursor-not-allowed">
                  {username || "-"}
                </span>
              </div>
            </div>

            {/* PASSWORD */}
            <div
              className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 max-w-4xl ml-12 mt-6"
              data-guide="change-password"
            >
              <div className="px-12 py-2 cursor-default">
                <p className="text-md font-bold text-gray-700 my-2">
                  Change Password
                </p>
              </div>

              <div className="flex items-center justify-between py-4 px-12">
                <div className="cursor-default">
                  <p className="text-sm text-gray-700">Password Saat Ini</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Masukkan password yang sekarang
                  </p>
                </div>
                <div className="relative w-52">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="text-sm px-3 py-1.5 pr-9 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showCurrentPw ? (
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
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-4 px-12">
                <div className="cursor-default">
                  <p className="text-sm text-gray-700">Password Baru</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Minimal 4 karakter
                  </p>
                </div>
                <div className="relative w-52">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="text-sm px-3 py-1.5 pr-9 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showNewPw ? (
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
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-4 px-12">
                <div className="cursor-default">
                  <p className="text-sm text-gray-700">Konfirmasi Password</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Ulangi password baru
                  </p>
                </div>
                <div className="relative w-52">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-sm px-3 py-1.5 pr-9 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showConfirmPw ? (
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
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end px-12 py-4">
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  className="text-sm px-5 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {savingPassword ? "Menyimpan..." : "Ubah Password"}
                </button>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-3 mt-8 mr-24">
              <button
                onClick={() => router.push("/settings")}
                className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-30 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                data-guide="btn-save"
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>

        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-teal-600 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {toast.msg}
          </div>
        )}
      </main>
      {/* USER GUIDE */}
      {guideOpen && (
        <>
          <GuideOverlay highlightRect={highlightRect} onSkip={finish} />

          <GuideModal
            isOpen={guideOpen}
            step={step}
            currentStep={currentStep}
            totalSteps={totalSteps}
            highlightRect={highlightRect}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            onNext={next}
            onBack={back}
            onFinish={finish}
          />
        </>
      )}

      <GuideButton
        onClick={openGuide}
        showFlyAnimation={showFlyAnimation}
        startCoords={startCoords}
        onAnimationComplete={resetFlyAnimation}
      />
    </div>
  );
}
