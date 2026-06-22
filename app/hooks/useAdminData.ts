'use client';

import { useState, useEffect } from 'react';

import {
  User,
  ResourceLimit,
  UsageLog,
  DashboardStats
} from '@/app/types/admin.types';

import {
  DEFAULT_RESOURCE_LIMITS,
  getTodayKey
} from '@/app/services/adminHelpers';

const ADMIN_API = '/api/admin';

export const useAdminData = () => {

  const [users, setUsers] = useState<User[]>([]);

  const [resourceLimits, setResourceLimits] =
    useState<ResourceLimit[]>(DEFAULT_RESOURCE_LIMITS);

  const [usageLogs, setUsageLogs] =
    useState<UsageLog[]>([]);

  const [dashboardStats, setDashboardStats] =
    useState<DashboardStats>({
      totalUsers: 0,
      activeUsersToday: 0,
      totalUsersToday: 0,
      totalUsageToday: 0,
      topLocations: [],
      recentActivities: [],
      activeUsers: [],
      weeklyUsage: [],
    });

  const [loginCountToday, setLoginCountToday] = useState(0);

  // =========================
// LOAD USERS FROM FLASK
// =========================
useEffect(() => {

  const fetchUsers = async () => {

    try {

      const res = await fetch(`${ADMIN_API}/users`);

      const data = await res.json();

      const formattedUsers = data.map(
        (u:any,index:number)=>({

          id:String(index+1),
          username:u.username,

          email:u.email || "",

          registeredAt:
            u.registeredAt || "",

          lastActive:
            u.lastActive || "",

          lastLogin:
            u.lastLogin || "",

          lastLogout:
            u.lastLogout || "",

          usageCount:
            u.usageCount || 0,

          location:
            u.location || "",

          isActive: u.isActive ?? true,

        }));

      setUsers(formattedUsers);

    } catch (err) {

      // silent — server mungkin sibuk

    }
  };

  const fetchLoginCount = async () => {
    try {
      const res = await fetch(`${ADMIN_API}/login-count`);
      const data = await res.json();
      setLoginCountToday(data.count);
    } catch (_) {}
  };

  fetchUsers();
  fetchLoginCount();
  const interval = setInterval(() => {
    fetchUsers();
    fetchLoginCount();
  }, 5000);
  return () => clearInterval(interval);

}, []);
  // =========================
  // LOAD INITIAL DATA (localStorage + Flask)
  // =========================
  useEffect(() => {

    const storedLimits =
      localStorage.getItem(
        'ventara-resource-limits'
      );

    if (storedLimits) {
      setResourceLimits(
        JSON.parse(storedLimits)
      );
    }

    const storedLogs =
      localStorage.getItem(
        'ventara-usage-logs'
      );

    if (storedLogs) {

      setUsageLogs(
        JSON.parse(storedLogs)
      );

    } else {
      setUsageLogs([]);
    }

  }, []);

  // =========================
  // DASHBOARD STATS
  // =========================
  useEffect(() => {

    const today = getTodayKey();

    const todayLogs =
      usageLogs.filter(log =>
        log.timestamp.startsWith(today)
      );

    const activeUsersToday =
      new Set(
        todayLogs.map(log => log.userId)
      ).size;

    const usersToday =
      users.filter(u =>
        u.lastLogin && u.lastLogin.startsWith(today)
      );

    const activeUsers =
      usersToday.filter(u =>
        !u.lastLogout || u.lastLogin > u.lastLogout
      );

    const locationMap =
      new Map<string, number>();

    usageLogs.forEach(log => {

      locationMap.set(
        log.location,
        (locationMap.get(log.location) || 0) + 1
      );

    });

    const topLocations =
      Array.from(locationMap.entries())
        .map(([location, count]) => ({
          location,
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Weekly usage (Senin - Minggu)
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weeklyLogs = usageLogs.filter(log => {
      const t = new Date(log.timestamp);
      return t >= monday && t <= sunday;
    });

    const dayCountMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dayCountMap.set(d.toISOString().split('T')[0], 0);
    }

    weeklyLogs.forEach(log => {
      const dateKey = log.timestamp.split('T')[0];
      if (dayCountMap.has(dateKey)) {
        dayCountMap.set(dateKey, (dayCountMap.get(dateKey) ?? 0) + 1);
      }
    });

    const weeklyUsage = Array.from(dayCountMap.entries()).map(([dateKey, count]) => {
      const d = new Date(dateKey);
      return { day: dayNames[d.getDay()], count };
    });

    setDashboardStats({
      totalUsers: users.length,
      activeUsersToday,
      totalUsersToday: usersToday.length,
      totalUsageToday: todayLogs.length + loginCountToday,
      topLocations,
      recentActivities:
        usageLogs.slice(-10).reverse(),
      activeUsers,
      weeklyUsage,
    });

  }, [users, usageLogs, loginCountToday]);

const updateResourceLimit = (
  id: string,
  field: "maxStorageMb" | string,
  value: number
) => {

  const updated =
    resourceLimits.map(r => {

      if (r.id !== id)
        return r;

      return { ...r, maxStorageMb: value };

    });

  setResourceLimits(updated);

  localStorage.setItem(
    "ventara-resource-limits",
    JSON.stringify(updated)
  );

};

const getUserUsageToday = (
  username: string
) => {

  const today = getTodayKey();

  return usageLogs.filter(
    log =>
      log.username === username &&
      log.timestamp.startsWith(today)
  ).length;

};

const activateUser = async (
  username: string,
  active: boolean = true
) => {
  try {
    const res = await fetch(`${ADMIN_API}/user-data/${username}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: active }),
    });

    if (!res.ok) {
      console.error('Failed to update user status: server menolak request');
      return;
    }

    setUsers(prev =>
      prev.map(u =>
        u.username === username ? { ...u, isActive: active } : u
      )
    );
  } catch (err) {
    console.error('Failed to update user status:', err);
  }
};

const updateUserStorageLimit = async (username: string, mb: number): Promise<boolean> => {
  try {
    const res = await fetch(`${ADMIN_API}/user-data/${username}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageLimitMb: mb }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to update storage limit:', err);
    return false;
  }
};

  return {
  users,
  setUsers,

  resourceLimits,

  usageLogs,
  dashboardStats,

  updateResourceLimit,
  updateUserStorageLimit,

  getUserUsageToday,

  activateUser,
};
};