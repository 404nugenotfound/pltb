"use client"

import React, { useState, useEffect } from "react"
import Sidebar from "@/app/components/layout/Sidebar"
import Header from "@/app/components/layout/Header"

interface PaymentRecord {
  transaction_id: string
  tier: string
  amount: number
  payment_type: string
  status: string
  paid_at: string
  reference: string
}

const TIER_LABEL: Record<string, string> = {
  basic: "Basic",
  business: "Business",
}

const PAYMENT_LABEL: Record<string, string> = {
  qris: "QRIS",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  bni_va: "BNI VA",
  bri_va: "BRI VA",
  permata_va: "Permata VA",
  cimb_niaga_va: "CIMB VA",
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPayments() {
      const username = sessionStorage.getItem("ventara_username") || ""
      if (!username) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/payment/history?username=${username}`)
        const json = await res.json()
        if (json.success) {
          setPayments(json.data.reverse())
        }
      } catch (err) {
        console.error("Failed to fetch payment history:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchPayments()
  }, [])

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}h lalu`
    if (hours > 0) return `${hours}j lalu`
    return `${mins}m lalu`
  }

  function formatAmount(amount: number) {
    return `Rp ${amount.toLocaleString("id-ID")}`
  }

  function calcFee(amount: number): number {
    return Math.round(amount * 0.007) + 400
  }

  function parseUsername(ref: string): string {
    const parts = ref.split("-")
    return parts.length >= 3 ? parts[2] : "-"
  }

  function getDescription(p: PaymentRecord): string {
    const label = TIER_LABEL[p.tier] || p.tier
    const name = parseUsername(p.reference)
    return `Upgrade ${label} - ${name}`
  }

  function getWebsite(ref: string): string {
    // Try to infer or default to localhost:3000
    return "localhost:3000"
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 2000)
  }

  // Summary stats
  const berhasil = payments.filter((p) => p.status === "settled" || p.status === "settlement" || p.status === "capture" || p.status === "success").length
  const menunggu = payments.filter((p) => p.status === "pending").length
  const totalBersih = payments
    .filter((p) => p.status === "settled" || p.status === "settlement" || p.status === "capture" || p.status === "success")
    .reduce((acc, p) => acc + (p.amount - calcFee(p.amount)), 0)

  // Filter & search
  const filtered = payments.filter((p) => {
    const name = parseUsername(p.reference).toLowerCase()
    const matchSearch =
      name.includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase()) ||
      p.transaction_id.toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "success" && (p.status === "settled" || p.status === "settlement" || p.status === "capture" || p.status === "success")) ||
      (filterStatus === "pending" && p.status === "pending") ||
      (filterStatus === "failed" && (p.status === "deny" || p.status === "cancel" || p.status === "expire" || p.status === "failure"))
    return matchSearch && matchStatus
  })

  function getStatusBadge(status: string) {
    const s = status?.toLowerCase()
    if (s === "settled" || s === "settlement" || s === "capture" || s === "success") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Berhasil
        </span>
      )
    }
    if (s === "pending") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Menunggu
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Gagal
      </span>
    )
  }

  function getAvatarColor(status: string) {
    const s = status?.toLowerCase()
    if (s === "settled" || s === "settlement" || s === "capture" || s === "success")
      return "bg-teal-50 text-teal-600"
    if (s === "pending") return "bg-amber-50 text-amber-500"
    return "bg-red-50 text-red-500"
  }

  function getArrowIcon(status: string) {
    const s = status?.toLowerCase()
    if (s === "settled" || s === "settlement" || s === "capture" || s === "success") {
      // arrow up-right (income/success)
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7v10" />
        </svg>
      )
    }
    // arrow down-right (failed/pending)
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 7L7 17M7 17h10M7 17V7" />
      </svg>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Header />
        <div className="p-8">
          <div className="max-w-5xl mx-auto">

            {/* Page Title */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Riwayat Pembayaran</h2>
              <p className="text-gray-500 text-sm">Daftar semua transaksi upgrade penyimpanan</p>
            </div>

            {/* Summary Bar */}
            {!loading && payments.length > 0 && (
              <div className="flex items-center gap-4 mb-5 text-sm flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-gray-700 font-medium shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {berhasil} berhasil
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-gray-700 font-medium shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {menunggu} menunggu
                </span>
                {/* <span className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-gray-700 shadow-sm">
                  Total bersih:{" "}
                  <span className="font-bold text-gray-900">{formatAmount(totalBersih)}</span>
                </span> */}
              </div>
            )}

            {/* Search & Filter Bar */}
            {!loading && payments.length > 0 && (
              <div className="flex items-center gap-3 mb-5">
                {/* Search */}
                <div className="flex-1 relative">
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari nama, email, referensi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
                  />
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="appearance-none bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer transition-all"
                  >
                    <option value="all">Semua Status</option>
                    <option value="success">Berhasil</option>
                    <option value="pending">Menunggu</option>
                    <option value="failed">Gagal</option>
                  </select>
                  {/* Filter icon */}
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  {/* Chevron */}
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-gray-500">Memuat riwayat...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-400 text-sm">Belum ada pembayaran</p>
                <p className="text-gray-400 text-xs mt-1">Pembayaran akan muncul di sini setelah upgrade</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <p className="text-gray-400 text-sm">Tidak ada transaksi yang cocok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((p) => {
                  const isOpen = expandedId === p.transaction_id
                  const fee = calcFee(p.amount)
                  const diterima = p.amount - fee
                  const customerName = parseUsername(p.reference)
                  const desc = getDescription(p)
                  const website = getWebsite(p.reference)

                  return (
                    <div
                      key={p.transaction_id}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md"
                    >
                      {/* Card Header — clickable */}
                      <button
                        onClick={() => setExpandedId(isOpen ? null : p.transaction_id)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        {/* Avatar / Status Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getAvatarColor(p.status)}`}>
                          {getArrowIcon(p.status)}
                        </div>

                        {/* Name & Time */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{customerName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatRelative(p.paid_at)}</p>
                        </div>

                        {/* Amount & Status */}
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-900 text-sm">{formatAmount(p.amount)}</p>
                          <div className="mt-1 flex justify-end">
                            {getStatusBadge(p.status)}
                          </div>
                        </div>

                        {/* Chevron */}
                        <svg
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : "rotate-0"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Expandable Detail — smooth grid-template-rows animation */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateRows: isOpen ? "1fr" : "0fr",
                          transition: "grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        <div style={{ overflow: "hidden" }}>
                          <div
                            className={`border-t border-gray-100 transition-opacity duration-300 ${
                              isOpen ? "opacity-100 delay-100" : "opacity-0"
                            }`}
                          >
                            {/* Top detail grid */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 pt-5 pb-4">
                              {/* Pelanggan */}
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Pelanggan</p>
                                  <p className="text-sm text-gray-800 font-semibold">{customerName}</p>
                                </div>
                              </div>

                              {/* Deskripsi */}
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Deskripsi</p>
                                  <p className="text-sm text-gray-800 font-semibold">{desc}</p>
                                </div>
                              </div>

                              {/* Tanggal */}
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Tanggal</p>
                                  <p className="text-sm text-gray-800 font-semibold">{formatDate(p.paid_at)}</p>
                                </div>
                              </div>

                              {/* Sumber Website */}
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Sumber Website</p>
                                  <p className="text-sm text-gray-800 font-semibold">{website}</p>
                                </div>
                              </div>
                            </div>

                            {/* Financial Summary Row */}
                            <div className="grid grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
                              <div className="bg-white px-5 py-3.5">
                                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Total Bayar</p>
                                <p className="text-sm font-bold text-gray-900">{formatAmount(p.amount)}</p>
                              </div>
                              <div className="bg-white px-5 py-3.5">
                                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Fee</p>
                                <p className="text-sm font-semibold text-gray-700">{formatAmount(fee)}</p>
                              </div>
                              <div className="bg-white px-5 py-3.5">
                                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Diterima</p>
                                <p className="text-sm font-bold text-teal-600">{formatAmount(diterima)}</p>
                              </div>
                            </div>

                            {/* Reference Footer */}
                            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                </svg>
                                <span className="text-xs text-gray-400 font-mono truncate">{p.reference}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(p.reference)
                                }}
                                className="ml-3 shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                title="Salin referensi"
                              >
                                {copied === p.reference ? (
                                  <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}