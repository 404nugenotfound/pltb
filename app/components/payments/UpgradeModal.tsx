"use client";

import { useState } from "react";
import PaymentCard from "@/app/components/payments/PaymentsCard";
import PaymentModal from "@/app/components/payments/PaymentModal";

interface StorageInfo {
  tier: string;
  limit_mb: number;
  usage_mb: number;
  percent: number;
}

interface UpgradeModalProps {
  storageInfo: StorageInfo;
  paymentHistory: any[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const TIER_ORDER = { free: 0, basic: 1, business: 2 };

const TIERS = [
  { key: "basic" as const,    label: "Basic",    storage_mb: "100.00 MB + 2 Cache",   harga: "Rp 2.000 / bulan"   },
  { key: "business" as const, label: "Business", storage_mb: "2048.00 MB + 10 Cache",  harga: "Rp 599.000 / bulan" },
];

export default function UpgradeModal({
  storageInfo,
  paymentHistory,
  onClose,
  onSuccess,
}: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<"basic" | "business">("basic");
  const [paymentTier, setPaymentTier] = useState<"basic" | "business" | null>(null);

  function isTierOwned(tier: string) {
    return (
      TIER_ORDER[tier as keyof typeof TIER_ORDER] <=
      TIER_ORDER[storageInfo.tier as keyof typeof TIER_ORDER]
    );
  }

  function getTierExpiry(tier: string): Date | null {
    const record = [...paymentHistory].reverse().find((p) => p.tier === tier);
    if (!record) return null;
    const expiry = new Date(record.paid_at);
    expiry.setDate(expiry.getDate() + 30);
    return expiry;
  }

  // Kalau PaymentModal sedang terbuka, render itu saja
  if (paymentTier) {
    return (
      <PaymentModal
        tier={paymentTier}
        onClose={() => setPaymentTier(null)}
        onSuccess={async () => {
          await onSuccess();
          setPaymentTier(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900 text-lg">
            Upgrade Penyimpanan
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Info paket saat ini */}
        <p className="text-sm text-gray-500 mb-5">
          Paket saat ini:{" "}
          <span className="text-teal-600 font-semibold capitalize">
            {storageInfo.tier} ({storageInfo.limit_mb} MB)
          </span>
        </p>

        {/* Tier Cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {TIERS.map((tier) => (
            <PaymentCard
              key={tier.key}
              tier_key={tier.key}
              label={tier.label}
              storage_mb={tier.storage_mb}
              harga={tier.harga}
              isOwned={isTierOwned(tier.key)}
              isCurrent={storageInfo.tier === tier.key}
              isSelected={selectedTier === tier.key}
              expiryDate={getTierExpiry(tier.key)}
              onSelect={setSelectedTier}
            />
          ))}
        </div>

        {/* Tombol CTA */}
        <button
          onClick={() => {
            if (!isTierOwned(selectedTier)) setPaymentTier(selectedTier);
          }}
          disabled={isTierOwned(selectedTier)}
          className="w-full py-3 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition capitalize cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isTierOwned(selectedTier)
            ? `${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} (Sudah Aktif)`
            : `Upgrade ke ${selectedTier} — ${
                { basic: "Rp 2.000", business: "Rp 599.000" }[selectedTier]
              }/bulan`}
        </button>

      </div>
    </div>
  );
}