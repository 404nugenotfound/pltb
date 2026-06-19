"use client";

interface PaymentCardProps {
  // Identitas tier
  tier_key: "basic" | "business";
  label: string;
  storage_mb: string;
  harga: string;           // e.g. "Rp 199.000 / bulan"

  // State dari parent
  isOwned: boolean;
  isCurrent: boolean;
  isSelected: boolean;
  expiryDate: Date | null;

  // Event
  onSelect: (tier: "basic" | "business") => void;
}

export default function PaymentCard({
  tier_key,
  label,
  storage_mb,
  harga,
  isOwned,
  isCurrent,
  isSelected,
  expiryDate,
  onSelect,
}: PaymentCardProps) {
  return (
    <div
      onClick={() => !isOwned && onSelect(tier_key)}
      className={`border-2 rounded-xl p-4 transition ${
        isOwned
          ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
          : isSelected
            ? "border-teal-400 bg-teal-50 cursor-pointer"
            : "border-gray-200 hover:border-gray-300 cursor-pointer"
      }`}
    >
      {/* Header: nama tier + badge */}
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold text-gray-800">{label}</span>
        {isOwned ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            {isCurrent ? "Paket Saat Ini" : "Sudah Dibeli"}
          </span>
        ) : (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Bayar
          </span>
        )}
      </div>

      {/* Storage */}
      <p className="text-xl font-bold text-gray-900">{storage_mb}</p>

      {/* Harga */}
      <p className="text-sm text-gray-500 mt-0.5">{harga}</p>

      {/* Expiry — hanya muncul kalau sudah dibeli */}
      {isOwned && expiryDate && (
        <p className="text-xs text-gray-400 mt-1">
          Berlaku sampai{" "}
          {expiryDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}