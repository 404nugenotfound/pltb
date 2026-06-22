'use client';
import Header from '@/app/components/layout/Header';
import Sidebar from '@/app/components/layout/Sidebar';
import { DashboardTab } from '@/app/components/admin/DashboardTab';
import { useAdminData } from '@/app/hooks/useAdminData';

export default function DashboardPage() {
  const { dashboardStats } = useAdminData();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header />
        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1 cursor-default">Admin Panel</h2>
              <p className="text-gray-600 text-sm cursor-default">Kelola pengguna, resource, dan pantau aktivitas sistem</p>
            </div>
            <DashboardTab stats={dashboardStats} />
          </div>
        </div>
      </main>
    </div>
  );
}