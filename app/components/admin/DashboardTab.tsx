"use client";

import { StatCard } from "@/app/components/admin/StatCard";
import { DashboardStats, UsageLog } from "@/app/types/admin.types";
import { formatDate } from "@/app/services/adminHelpers";

interface DashboardTabProps {
  stats: DashboardStats;
}

export const DashboardTab = ({ stats }: DashboardTabProps) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm cursor-default">
        <StatCard
          title="Total Pengguna"
          value={stats.totalUsers}
          subtitle="Terdaftar di sistem"
          isFirst={true}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          title="Generate Hari Ini"
          value={stats.generateToday}
          subtitle="Generate general & best"
          isSecond={true}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          title="Training Hari Ini"
          value={stats.trainingToday}
          subtitle="Upload & train dataset"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Locations */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="p-5">
            <h3 className="font-semibold text-[#003b33] mb-4 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00a991] to-[#008774] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-base cursor-default">Top Lokasi Penggunaan</span>
            </h3>
            <div className="space-y-2">
              {stats.topLocations.length > 0 ? (
                stats.topLocations.map((loc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100 cursor-default"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? "bg-[#00a991]/10 text-[#00a991]" : "bg-gray-100 text-gray-500"
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="font-medium text-gray-700 text-sm">{loc.location}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#00a991]">{loc.count} kali</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-8 text-sm">Belum ada data penggunaan</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="p-5">
            <h3 className="font-semibold text-[#003b33] mb-4 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00a991] to-[#008774] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-base cursor-default">Aktivitas Terakhir</span>
            </h3>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1 custom-scroll cursor-default">
              {stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((activity: UsageLog) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#00a991]/10 flex items-center justify-center text-xs font-semibold text-[#00a991] shrink-0">
                        {activity.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">{activity.username}</p>
                        <p className="text-xs text-gray-400">{activity.featureName} • {activity.location}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{formatDate(activity.timestamp)}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-8 text-sm">Belum ada aktivitas</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #b0e4dd; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #00a991; }
      `}</style>
    </div>
  );
};