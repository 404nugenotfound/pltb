'use client';

import { useState, useEffect } from 'react';

import {
  User,
  ResourceLimit,
  UserResourceLimit,
  UsageLog,
  DashboardStats
} from '@/app/types/admin.types';

import {
  DEFAULT_RESOURCE_LIMITS,
  getTodayKey
} from '@/app/services/adminHelpers';

import { PYTHON_API_URL } from '@/app/lib/api';

const getSampleUsageLogs = (): UsageLog[] => {
  const logs: UsageLog[] = [];
  const users = ['Administrator', 'kakang_kukung', 'joko_wind'];
  const features = [
    { id: 'forecast', name: 'Forecasting / Prediksi' },
    { id: 'analitik', name: 'Report Analytics' },
    { id: 'trends', name: 'Trends Reports' },
    { id: 'export', name: 'Export Data' },
  ];
  const locations = ['Jakarta', 'Bawean', 'Surabaya', 'Bandung', 'Semarang'];
  let id = 1;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const dailyCounts = [3, 5, 2, 7, 4, 6, 1];

  for (let d = 0; d < 7; d++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + d);
    const count = dailyCounts[d];

    for (let i = 0; i < count; i++) {
      const hour = 7 + Math.floor(Math.random() * 12);
      const minute = Math.floor(Math.random() * 60);
      date.setHours(hour, minute, 0, 0);

      const user = users[Math.floor(Math.random() * users.length)];
      const feature = features[Math.floor(Math.random() * features.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];

      logs.push({
        id: String(id++),
        userId: String((users.indexOf(user) + 1)),
        username: user,
        featureId: feature.id,
        featureName: feature.name,
        location,
        timestamp: date.toISOString(),
      });
    }
  }

  return logs.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

export const useAdminData = () => {

  const [users, setUsers] = useState<User[]>([]);

  const [resourceLimits, setResourceLimits] =
    useState<ResourceLimit[]>(DEFAULT_RESOURCE_LIMITS);

  const [userResourceLimits, setUserResourceLimits] =
    useState<UserResourceLimit[]>([]);

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

      const res = await fetch(
        `${PYTHON_API_URL}/users`
      );

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
      const res = await fetch(
        `${PYTHON_API_URL}/login-count`
      );
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

    const storedUserLimits =
      localStorage.getItem(
        'ventara-user-resource-limits'
      );

    if (storedUserLimits) {
      setUserResourceLimits(
        JSON.parse(storedUserLimits)
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
      setUsageLogs(getSampleUsageLogs());
    }

  }, [users]);

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

const updateUserResourceLimit = (
  userId: string,
  featureId: string,
  _field: string,
  value: number
) => {

  const existing =
    userResourceLimits.find(
      x =>
        x.userId === userId &&
        x.id === featureId
    );

  const base =
    existing ??
    {
      ...resourceLimits.find(
        r => r.id === featureId
      )!,

      userId,

      username:
        users.find(
          u => u.id === userId
        )?.username || ""

    };

  const updatedItem = { ...base, maxStorageMb: value };

  const updated = [

    ...userResourceLimits.filter(
      x =>
        !(
          x.userId === userId &&
          x.id === featureId
        )
    ),

    updatedItem

  ];

  setUserResourceLimits(updated);

  localStorage.setItem(
    "ventara-user-resource-limits",
    JSON.stringify(updated)
  );

  // Save to Flask server
  const username = users.find(u => u.id === userId)?.username;
  if (username) {
    fetch(`${PYTHON_API_URL}/user-data/${username}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceLimits: Object.fromEntries(
          updated
            .filter(x => x.userId === userId)
            .map(x => [x.id, {
              featureName: x.featureName,
              description: x.description,
              maxStorageMb: x.maxStorageMb,
            }])
        ),
      }),
    }).catch(_ => {});
  }

};

const getUserLimit = (
  userId: string,
  featureId: string
): { maxStorageMb: number } => {

  const custom =
    userResourceLimits.find(
      x =>
        x.userId === userId &&
        x.id === featureId
    );

  if (custom) {
    return { maxStorageMb: custom.maxStorageMb };
  }

  const def =
    resourceLimits.find(
      x => x.id === featureId
    );

  return { maxStorageMb: def?.maxStorageMb ?? 10 };

};

const getUserUsageToday = (
  userId: string
) => {

  const today = getTodayKey();

  return usageLogs.filter(
    log =>
      log.userId === userId &&
      log.timestamp.startsWith(today)
  ).length;

};

const deleteUser = (
  userId: string
) => {

  setUsers(prev =>
    prev.filter(
      u => u.id !== userId
    )
  );

};

const activateUser = async (
  userId: string,
  active: boolean = true
) => {
  const username = users.find(u => u.id === userId)?.username;
  if (!username) return;
  try {
    await fetch(`${PYTHON_API_URL}/user-data/${username}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: active }),
    });
    setUsers(prev =>
      prev.map(u =>
        u.id === userId ? { ...u, isActive: active } : u
      )
    );
  } catch (err) {
    console.error('Failed to update user status:', err);
  }
};

const fetchUserData = async (username: string): Promise<{ resourceLimits?: Record<string, { maxStorageMb: number }>; history?: any[]; storageLimitMb?: number } | null> => {
  try {
    const res = await fetch(`${PYTHON_API_URL}/user-data/${username}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
};

const updateUserStorageLimit = async (username: string, mb: number): Promise<boolean> => {
  try {
    const res = await fetch(`${PYTHON_API_URL}/user-data/${username}`, {
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
  userResourceLimits,
  setUserResourceLimits,

  usageLogs,
  dashboardStats,

  updateResourceLimit,
  updateUserResourceLimit,
  updateUserStorageLimit,

  getUserLimit,
  getUserUsageToday,

  deleteUser,
  activateUser,

  fetchUserData,
};
};