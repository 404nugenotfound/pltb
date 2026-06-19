"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTraining } from "@/app/context/TrainingContext";

import { Bebas_Neue } from "next/font/google";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { cancelTraining, stopTraining } = useTraining();
  const [role, setRole] = useState<"user" | "admin">("user");
  const [name, setName] = useState("User");
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [avatar, setAvatar] = useState("/icon/avatar-default.svg");
  const isDefaultAvatar = avatar === "/icon/avatar-default.svg";

  const isMoreActive = pathname === "/history" || pathname === "/settings";

  useEffect(() => {
    const savedRole = sessionStorage.getItem("ventara_role") as
      | "user"
      | "admin"
      | null;
    const savedName = sessionStorage.getItem("ventara_name");
    const savedAvatar = sessionStorage.getItem("ventara_avatar"); // ← tambah
    if (savedRole) setRole(savedRole);
    if (savedName) setName(savedName);
    if (savedAvatar && savedAvatar !== "null") setAvatar(savedAvatar);
    if (pathname === "/history" || pathname === "/settings") setOpen(true);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setProfileOpen(false);

    // Stop toast & cancel training dulu
    stopTraining(); // langsung hilangkan banner
    try {
      await cancelTraining(); // cancel di Flask
    } catch (e) {
      console.error("Cancel training on logout failed:", e);
    }

    await fetch("http://localhost:5000/logout", {
      method: "POST",
      credentials: "include",
    });

    sessionStorage.clear();
    router.push("/");
  }

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
      pathname === href
        ? "bg-teal-100 text-teal-700"
        : "text-gray-600 hover:bg-gray-50"
    }`;

  const subLinkClass = (href: string) =>
    `flex items-center gap-4 px-4 py-2 text-sm rounded-lg transition-colors ${
      pathname === href
        ? "bg-teal-50 text-teal-700 font-medium"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="py-7 pl-7 mt-2 flex justify-start">
        <img src="/icon/logo-ventara.svg" className="h-7" alt="Ventara Logo" />
      </div>

      <nav className="flex-1 mt-14 px-6 space-y-3 font-semibold">
        {role === "user" && (
          <>
            {/* SECTION LABEL */}
            <div
              className={` ${bebasNeue.className} text-xl tracking-[0.3rem] font-semibold text-gray-400 uppercase px-2 pb-3 pt-4 mb-4 cursor-default`}
            >
              Menu
            </div>
            {/* Forecasting */}
            <Link href="/forecasting" className={linkClass("/forecasting")}>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
              Forecasting
            </Link>

            {/* Analytics */}
            <Link href="/analytics" className={linkClass("/analytics")}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
              </svg>
              Report Analytics
            </Link>

            {/* More Feature Dropdown */}
            <div>
              <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                  isMoreActive
                    ? "bg-teal-100 text-teal-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  More Feature
                </div>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <div className="ml-2 mt-2 space-y-1">
                  <Link href="/history" className={subLinkClass("/history")}>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    History Data
                  </Link>

                  <Link
                    href="/history/payments"
                    className={subLinkClass("/history/payments")}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 10h18M7 15h1m3 0h2m-8 5h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    History Payments
                  </Link>

                  <Link href="/settings" className={subLinkClass("/settings")}>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        {role === "admin" && (
          <>
            {/* SECTION LABEL */}
            <div
              className={` ${bebasNeue.className} text-xl tracking-[0.3rem] font-semibold text-gray-400 uppercase px-2 pb-3 pt-4 `}
            >
              Admin Menu
            </div>
            {/* Dashboard */}
            <Link
              href="/admin/dashboard"
              className={linkClass("/admin/dashboard")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Dashboard
            </Link>

            {/* Manage Resource */}
            <Link
              href="/admin/resources"
              className={linkClass("/admin/resources")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              Manage Resource
            </Link>

            {/* User Manager */}
            <Link href="/admin/users" className={linkClass("/admin/users")}>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              User Manager
            </Link>
          </>
        )}
      </nav>

      {/* PROFILE */}
      <div className="p-4 border-t border-gray-200 relative" ref={profileRef}>
        {/* Popover */}
        <div
          className={`
          absolute bottom-full left-4 right-4 mb-2
          bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden
          transition-all duration-200 origin-bottom
          ${profileOpen ? "opacity-100 scale-y-100 translate-y-0" : "opacity-0 scale-y-95 translate-y-1 pointer-events-none"}
        `}
        >
          <div className="px-4 py-3 border-b border-gray-100 cursor-default">
            <p className="text-xs text-gray-400">Masuk sebagai</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">{name}</p>
            <p className="text-xs text-teal-600 mt-0.5 capitalize">{role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Logout
          </button>
        </div>

        {/* Trigger */}
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
            {isDefaultAvatar ? (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-full h-full bg-gray-200 text-gray-500 border-4 rounded-full"
              >
                <path d="M12 12c2.761 0 5-2.239 5-5S14.761 2 12 2 7 4.239 7 7s2.239 5 5 5Zm0 2c-4.418 0-8 3.582-8 8h16c0-4.418-3.582-8-8-8Z" />
              </svg>
            ) : (
              <img
                src={avatar}
                className="w-full h-full object-cover rounded-full"
                alt=""
              />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs text-gray-400 capitalize">
              {role === "admin" ? "Administrator" : "User Analitik"}
            </p>
            <p className="text-sm font-semibold text-gray-700 truncate">
              {name}
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${profileOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}
