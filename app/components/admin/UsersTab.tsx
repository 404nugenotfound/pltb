'use client';

import { User } from '@/app/types/admin.types';
import { formatDate } from '@/app/services/adminHelpers';

interface UsersTabProps {
  users: User[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDeactivateUser: (username: string) => void;
  onActivateUser: (username: string) => void;
  getUserUsageToday: (username: string) => number;
}

export const UsersTab = ({
  users,
  searchQuery,
  onSearchChange,
  onDeactivateUser,
  onActivateUser,
  getUserUsageToday,
}: UsersTabProps) => {
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-0 bg-linear-to-r from-[#00a991]/10 to-[#008774]/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative">
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#00a991] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari pengguna berdasarkan username atau email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-5 py-4 rounded-2xl border border-gray-200 bg-white/80 text-gray-600 backdrop-blur-sm focus:ring-2 focus:ring-[#00a991]/40 focus:border-[#00a991] outline-none transition-all"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-200">
            <thead>
              <tr className="border-b border-gray-100 bg-linear-to-r from-[#e6f6f4]/30 to-transparent cursor-default">
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#007f6d] uppercase tracking-wider">Username</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#007f6d] uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#007f6d] uppercase tracking-wider">Lokasi</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#007f6d] uppercase tracking-wider">Terdaftar</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#007f6d] uppercase tracking-wider">Penggunaan</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#007f6d] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#007f6d] uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 cursor">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p>Tidak ada pengguna ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.username} className="border-b border-gray-50 hover:bg-linear-to-r hover:from-[#e6f6f4]/30 hover:to-transparent transition-all duration-300 group/row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                          user.isActive 
                            ? 'bg-linear-to-br from-[#00a991]/20 to-[#008774]/20 text-[#00a991]' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-700 cursor-default">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm cursor-default">{user.email}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm cursor-default">{user.location}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs font-mono cursor-default">{formatDate(user.registeredAt)}</td>
                    <td className="px-6 py-4 cursor-default">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[#00a991]">{user.usageCount} kali</span>
                        <span className="text-xs text-gray-400">Hari ini: {getUserUsageToday(user.username)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium cursor-default ${
                        user.isActive 
                          ? 'bg-[#e6f6f4] text-[#00a991] border border-[#00a991]/30' 
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-[#00a991] animate-pulse' : 'bg-gray-400'}`} />
                        {user.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.isActive ? (
                          <button
                            onClick={() => onDeactivateUser(user.username)}
                            className="text-gray-400 hover:text-red-500 transition-all px-3 py-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                            title="Nonaktifkan Pengguna"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" strokeWidth="2" />
                              <line x1="10" y1="9" x2="10" y2="15" strokeWidth="2" strokeLinecap="round" />
                              <line x1="14" y1="9" x2="14" y2="15" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => onActivateUser(user.username)}
                            className="text-gray-400 hover:text-[#00a991] transition-all px-3 py-1.5 rounded-lg hover:bg-[#e6f6f4] cursor-pointer"
                            title="Aktifkan Pengguna"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};