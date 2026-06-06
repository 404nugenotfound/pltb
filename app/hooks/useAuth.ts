'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type AuthView = 'landing' | 'register' | 'login';

export function useAuth() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>('landing');
  const [isError, setIsError] = useState(false);

  const handleLogin = async (
  username: string,
  password: string,
    // token: string
) => {
  try {
    const res = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username,
        password,
        //  token,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      setIsError(true);
      setTimeout(() => setIsError(false), 4000);
      return;
    }

    sessionStorage.setItem("ventara_role", data.role);
    sessionStorage.setItem("ventara_name", data.name);
    sessionStorage.setItem("ventara_username", data.username);
    sessionStorage.setItem("ventara_email", data.email || "");
    sessionStorage.setItem("ventara_avatar", data.avatar || "");
    document.cookie = `ventara_username=${data.username}; path=/; SameSite=Lax`; // ← tambah ini

    router.push(
      data.role === "admin"
        ? "/admin/dashboard"
        : "/forecasting"
    );

  } catch {
    setIsError(true);
    setTimeout(() => setIsError(false), 4000);
  }
};

  const handleRegister = async (username: string, email: string, password: string) => {
    if (!username || !email || !password) {
      alert('⚠️ All fields are required.');
      return;
    }
    if (!email.includes('@')) {
      alert('📧 Invalid email.');
      return;
    }
    if (password.length < 4) {
      alert('🔒 Password minimum 4 characters.');
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, name: username }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(`❌ ${data.message}`);
        return;
      }

      alert(`🎉 ${data.message} Please login.`);
      setView('login');

    } catch {
      alert('❌ Server error. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    alert('📩 Reset password feature coming soon.');
  };

  return {
    view,
    setView,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    isError,
  };
}