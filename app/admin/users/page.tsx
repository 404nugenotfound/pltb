'use client';
import { useState } from 'react';
import Header from '@/app/components/layout/Header';
import Sidebar from '@/app/components/layout/Sidebar';
import { UsersTab } from '@/app/components/admin/UsersTab';
import { DeleteConfirmModal } from '@/app/components/admin/DeleteConfirmModal';
import { useAdminData } from '@/app/hooks/useAdminData';

export default function UsersPage() {
  const { users, dashboardStats, activateUser, getUserUsageToday } = useAdminData();
  const [searchUser, setSearchUser] = useState('');
  const [usernameToConfirm, setUsernameToConfirm] = useState<string | null>(null);

  const targetUser = users.find(u => u.username === usernameToConfirm);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header />
        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Manage Users</h2>
              <p className="text-gray-600 text-sm">Kelola pengguna dan pantau aktivitas sistem</p>
            </div>
            <UsersTab
              users={users}
              searchQuery={searchUser}
              onSearchChange={setSearchUser}
              onDeactivateUser={(username) => setUsernameToConfirm(username)}
              onActivateUser={activateUser}
              getUserUsageToday={getUserUsageToday}
            />
          </div>
        </div>
      </main>
      <DeleteConfirmModal
        isOpen={!!usernameToConfirm}
        username={targetUser?.username || ''}
        mode="deactivate"
        onConfirm={() => {
          if (usernameToConfirm) {
            activateUser(usernameToConfirm, false);
            setUsernameToConfirm(null);
          }
        }}
        onCancel={() => setUsernameToConfirm(null)}
      />
    </div>
  );
}