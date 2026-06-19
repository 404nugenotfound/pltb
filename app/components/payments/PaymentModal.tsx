"use client"

import { useState, useEffect, useCallback } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { PYTHON_API_URL } from "@/app/lib/api"

const TIER_AMOUNT: Record<string, number> = {
  basic: 2000,
  business: 299000,
}

const TIER_LABEL: Record<string, string> = {
  basic: "Basic (100 MB + 2 Cache)",
  
  business: "Business (2048 MB)",
}

const PAYMENT_LABEL: Record<string, string> = {
  qris: "QRIS",
  gopay: "GoPay",
  bni_va: "BNI Virtual Account",
  bri_va: "BRI Virtual Account",
  permata_va: "Permata Virtual Account",
  cimb_niaga_va: "CIMB Niaga Virtual Account",
}

const BANK_LABEL: Record<string, string> = {
  bni: "BNI",
  bri: "BRI",
  permata: "Permata",
  cimb_niaga: "CIMB Niaga",
}

interface PaymentModalProps {
  tier: "basic" | "business"
  onClose: () => void
  onSuccess: () => void
}

type PaymentStatus = "idle" | "loading" | "ready" | "paid" | "expired" | "error"

export default function PaymentModal({ tier, onClose, onSuccess }: PaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>("idle")
  const [qrString, setQrString] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [expiredAt, setExpiredAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [paymentType, setPaymentType] = useState("qris")
  const [vaNumber, setVaNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [deeplinkUrl, setDeeplinkUrl] = useState("")
  const [selectedMethod, setSelectedMethod] = useState("qris")

  const amount = TIER_AMOUNT[tier]
  const tierLabel = TIER_LABEL[tier]

  const refreshStorage = useCallback(async () => {
    const username = sessionStorage.getItem("ventara_username") || ""
    onSuccess()
  }, [onSuccess])

  const createTransaction = useCallback(async (payment_type: string) => {
    setStatus("loading")
    setErrorMsg("")
    const username = sessionStorage.getItem("ventara_username") || ""

    try {
      const res = await fetch("/api/payment/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          payment_type,
          customer_name: username,
          tier,
        }),
      })
      const json = await res.json()

      if (json.success && json.payment) {
        setQrString(json.payment.qr_string || "")
        setTransactionId(json.transaction.id)
        setExpiredAt(json.payment.expired_at || null)
        setPaymentType(json.payment.payment_type || payment_type)
        setVaNumber(json.payment.va_number || "")
        setBankName(json.payment.bank || "")
        setDeeplinkUrl(json.payment.deeplink_url || "")
        setStatus("ready")
      } else {
        setStatus("error")
        setErrorMsg(json.error || "Gagal membuat transaksi")
      }
    } catch {
      setStatus("error")
      setErrorMsg("Gagal menghubungi server")
    }
  }, [amount, tier])

  useEffect(() => {
    if (status !== "ready") return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/check-status?id=${transactionId}`)
        const json = await res.json()
        if (json.success && json.transaction?.status === "settled") {
          clearInterval(interval)

          const username = sessionStorage.getItem("ventara_username") || ""
          const upgradeRes = await fetch(`${PYTHON_API_URL}/upgrade_tier`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Username": username },
            credentials: "include",
            body: JSON.stringify({ tier }),
          })

          if (!upgradeRes.ok) {
            console.error("Upgrade failed:", await upgradeRes.text())
            return
          }

          setStatus("paid")

          await fetch("/api/payment/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              transaction_id: transactionId,
              tier,
              amount,
              payment_type: paymentType,
              reference: `ventara-${tier}-${username}`,
            }),
          })

          setTimeout(() => {
            refreshStorage()
          }, 1500)
        }
      } catch {
        // silent retry
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [status, transactionId, tier, refreshStorage])

  useEffect(() => {
    if (!expiredAt) return

    const tick = () => {
      const diff = new Date(expiredAt).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown("Kedaluwarsa")
        setStatus("expired")
        return
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`)
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiredAt])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <h3 className="font-semibold text-gray-900 text-lg mb-1">
          Pembayaran {PAYMENT_LABEL[paymentType] || paymentType.toUpperCase()}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{tierLabel}</p>

        {status === "idle" && (
          <>
            <div className="mb-1">
              <p className="text-2xl font-bold text-gray-900 mb-1">
                Rp {amount.toLocaleString("id-ID")}
              </p>
            </div>

            <div className="text-left mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Pilih Metode Pembayaran</p>
              <div className="space-y-2">
                {[
                  { value: "qris", label: "QRIS", desc: "Scan QR via GoPay / ShopeePay / LinkAja / QRIS" },
                  { value: "gopay", label: "GoPay", desc: "Bayar langsung via aplikasi GoPay" },
                  { value: "bni_va", label: "BNI Virtual Account", desc: "Transfer ke nomor VA BNI" },
                  { value: "bri_va", label: "BRI Virtual Account", desc: "Transfer ke nomor VA BRI" },
                  { value: "permata_va", label: "Permata Virtual Account", desc: "Transfer ke nomor VA Permata" },
                  { value: "cimb_niaga_va", label: "CIMB Niaga Virtual Account", desc: "Transfer ke nomor VA CIMB" },
                ].map((m) => (
                  <label
                    key={m.value}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedMethod === m.value
                        ? "border-teal-400 bg-teal-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={m.value}
                      checked={selectedMethod === m.value}
                      onChange={() => setSelectedMethod(m.value)}
                      className="w-4 h-4 text-teal-600 accent-teal-600 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.label}</p>
                      <p className="text-xs text-gray-400">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => createTransaction(selectedMethod)}
              className="w-full py-3 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition"
            >
              Bayar Sekarang
            </button>
          </>
        )}

        {status === "loading" && (
          <div className="py-10">
            <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-500">Menyiapkan pembayaran...</p>
          </div>
        )}

        {status === "ready" && (
          <>
            {qrString ? (
              <div className="bg-white p-3 rounded-xl border border-gray-200 inline-block mx-auto mb-4">
                <QRCodeCanvas value={qrString} size={220} level="H" />
              </div>
            ) : vaNumber ? (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 text-left">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                  Nomor Virtual Account
                </p>
                <p className="text-lg font-bold text-gray-900 tracking-wider font-mono">{vaNumber}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Bank: {BANK_LABEL[bankName] || bankName}
                </p>
              </div>
            ) : null}

            {deeplinkUrl && (
              <a
                href={deeplinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 px-5 py-2.5 rounded-xl mb-3 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Buka {PAYMENT_LABEL[paymentType] || paymentType.toUpperCase()}
              </a>
            )}

            <p className="text-2xl font-bold text-gray-900 mb-2">
              Rp {amount.toLocaleString("id-ID")}
            </p>
            <p className="text-sm text-gray-500 mb-3">
              {vaNumber
                ? "Transfer ke nomor VA di atas"
                : deeplinkUrl
                  ? "Klik tombol untuk membuka aplikasi pembayaran"
                  : "Scan QR di atas dengan GoPay / ShopeePay / LinkAja / QRIS"}
            </p>
            <p className="text-sm text-amber-600 font-medium">
              ⏱ {countdown}
            </p>
          </>
        )}

        {status === "paid" && (
          <div className="py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-lg font-semibold text-green-700">Pembayaran Berhasil!</p>
            <p className="text-sm text-gray-500 mt-1">Storage sedang diupgrade...</p>
          </div>
        )}

        {status === "expired" && (
          <div className="py-8">
            <p className="text-lg font-semibold text-red-600 mb-2">Waktu Habis</p>
            <p className="text-sm text-gray-500 mb-4">
              {vaNumber ? "VA telah kedaluwarsa" : "Pembayaran telah kedaluwarsa"}
            </p>
            <button
              onClick={() => createTransaction(paymentType)}
              className="w-full py-3 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition"
            >
              Buat Ulang Pembayaran
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="py-8">
            <p className="text-lg font-semibold text-red-600 mb-1">Gagal</p>
            <p className="text-sm text-gray-500 mb-4">{errorMsg}</p>
            <button
              onClick={() => createTransaction(paymentType)}
              className="w-full py-3 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {status !== "paid" && (
          <button
            onClick={onClose}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Batal
          </button>
        )}
      </div>
    </div>
  )
}