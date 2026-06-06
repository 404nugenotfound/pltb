"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface StorageInfo {
  tier: string;
  usage_mb: number;
  limit_mb: number;
  percent: number;
}

interface StorageContextType {
  storageInfo: StorageInfo;
  refreshStorage: () => Promise<void>;
}

const StorageContext = createContext<StorageContextType | null>(null);

export function StorageProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [storageInfo, setStorageInfo] =
    useState<StorageInfo>({
      tier: "gratis",
      usage_mb: 0,
      limit_mb: 10,
      percent: 0,
    });

  const refreshStorage = async () => {
    try {
      const username =
        sessionStorage.getItem("ventara_username") || "";

      const res = await fetch(
        `/api/storage-info?username=${username}`
      );

      const json = await res.json();

      if (json.success) {
        setStorageInfo(json);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
  const username = sessionStorage.getItem("ventara_username");
  if (username) {  // ← hanya fetch kalau sudah login
    refreshStorage();
  }
}, []);

  return (
    <StorageContext.Provider
      value={{
        storageInfo,
        refreshStorage,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const ctx = useContext(StorageContext);

  if (!ctx) {
    throw new Error(
      "useStorage must be used inside StorageProvider"
    );
  }

  return ctx;
}