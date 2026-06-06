"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";

const DEFAULT_AVATAR = "/icon/default-avatar-profile.jpg";

export default function EditProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [avatarError, setAvatarError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setUsername(sessionStorage.getItem("ventara_username") || "");
    setName(sessionStorage.getItem("ventara_name") || "");
    setEmail(sessionStorage.getItem("ventara_email") || "");
    setAvatar(sessionStorage.getItem("ventara_avatar") || DEFAULT_AVATAR);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("http://localhost:5000/update_profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, name, email }),
      });
      const data = await res.json();
      if (!data.success) {
        setSaveMsg("❌ " + data.message);
        return;
      }
      sessionStorage.setItem("ventara_name", data.name);
      sessionStorage.setItem("ventara_email", data.email);
      setSaveMsg("✅ Profil berhasil disimpan!");
      setTimeout(() => router.push("/settings"), 1500);
    } catch {
      setSaveMsg("❌ Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword() {
  if (!currentPassword || !newPassword || !confirmPassword) {
    setPasswordMsg("❌ Semua field password harus diisi.");
    return;
  }
  if (newPassword !== confirmPassword) {
    setPasswordMsg("❌ Password baru tidak cocok.");
    return;
  }
  if (newPassword.length < 4) {
    setPasswordMsg("❌ Password minimal 4 karakter.");
    return;
  }
  setSavingPassword(true);
  setPasswordMsg("");
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
      setPasswordMsg("❌ " + data.message);
      return;
    }
    setPasswordMsg("✅ Password berhasil diubah!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  } catch {
    setPasswordMsg("❌ Gagal terhubung ke server.");
  } finally {
    setSavingPassword(false);
  }
}

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const result = reader.result as string;
    setAvatar(result);
    setAvatarError(false);
    sessionStorage.setItem("ventara_avatar", result);

    const currentUsername = sessionStorage.getItem("ventara_username") || username; // ← fix
    await fetch("http://localhost:5000/update_profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: currentUsername, avatar: result }),
    });
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Settings
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-8">Edit Profile</h2>

            {/* AVATAR */}
            <div className="flex items-center gap-10 mb-8 max-w-4xl px-14 py-5 ml-12 bg-white border border-gray-100 rounded-xl">
              <div
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
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Foto Profil</p>
                <p className="text-xs text-gray-400">Klik foto untuk mengganti foto profil pengguna</p>
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
            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 max-w-4xl ml-12">

              {/* Nama */}
              <div className="flex items-center justify-between py-4 px-12">
                <div>
                  <p className="text-sm text-gray-700">Nama</p>
                  <p className="text-xs text-gray-400 mt-0.5">Nama yang ditampilkan di aplikasi</p>
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
                <div>
                  <p className="text-sm text-gray-700">Email</p>
                  <p className="text-xs text-gray-400 mt-0.5">Email akun Anda</p>
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
                <div>
                  <p className="text-sm text-gray-700">Username</p>
                  <p className="text-xs text-gray-400 mt-0.5">Username tidak dapat diubah</p>
                </div>
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-100">{username || "-"}</span>
              </div>
            </div>

            {/* PASSWORD */}
            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 max-w-4xl ml-12 mt-6">
              <div className="px-12 py-4">
                <p className="text-sm font-medium text-gray-700 mb-4">Ubah Password</p>
              </div>

              <div className="flex items-center justify-between py-4 px-12">
                <div>
                  <p className="text-sm text-gray-700">Password Saat Ini</p>
                  <p className="text-xs text-gray-400 mt-0.5">Masukkan password yang sekarang</p>
                </div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-52"
                />
              </div>

              <div className="flex items-center justify-between py-4 px-12">
                <div>
                  <p className="text-sm text-gray-700">Password Baru</p>
                  <p className="text-xs text-gray-400 mt-0.5">Minimal 4 karakter</p>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-52"
                />
              </div>

              <div className="flex items-center justify-between py-4 px-12">
                <div>
                  <p className="text-sm text-gray-700">Konfirmasi Password</p>
                  <p className="text-xs text-gray-400 mt-0.5">Ulangi password baru</p>
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 text-gray-700 w-52"
                />
              </div>

              {passwordMsg && (
                <div className="px-12 py-3">
                  <p className="text-sm">{passwordMsg}</p>
                </div>
              )}

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

            {/* Save message */}
            {saveMsg && (
              <div className="mt-4 px-4 py-2">
                <p className="text-sm">{saveMsg}</p>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-3 mt-8 mr-24">
              <button
                onClick={() => router.push("/settings")}
                className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-30 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}