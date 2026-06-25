"use client";

import { useState, useRef } from "react";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

import { Bebas_Neue } from "next/font/google";
import { poppins } from "@/app/fonts";

import ReCAPTCHA from "react-google-recaptcha";

interface Props {
  onLogin: (
    username: string,
    password: string,
    // token: string
  ) => void;
  onSwitch: () => void;
  onForgotPassword: () => void;
}

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

export default function LoginForm({
  onLogin,
  onSwitch,
  onForgotPassword,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const captchaRef = useRef<ReCAPTCHA>(null);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[linear-gradient(135deg,#163832_0%,#1f4d45_28%,#2d6a5f_58%,#3f8f7f_100%)] flex justify-center items-center p-4 px-14">
      {/* TOP GLOW */}
      <div className="absolute -top-30 -left-20 w-70 h-70 rounded-full bg-white/10 blur-[100px]" />

      {/* BOTTOM GLOW */}
      <div className="absolute -bottom-30 -right-20 w-70 h-70 rounded-full bg-emerald-300/10 blur-[100px]" />

      {/* GRID */}
      <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-size-[42px_42px]" />

      {/* FORM */}
      <form
        onSubmit={(e) => {
          e.preventDefault();

          // const token = captchaRef.current?.getValue();

          // if (!token) {
          //   alert("Verifikasi captcha dulu");
          //   return;
          // }

          onLogin(username, password, );
        }}
        className="relative z-10 w-full max-w-140"
      >
        {/* TITLE */}
        <h1
          className={`
         ${bebasNeue.className}
        font-bold text-white mb-2`}
        >
          <span className="block text-[60px] -mb-4">
            WELCOME BACK{" "}
            <span className="inline-block w-16 h-2 rounded-full mb-4 bg-white" />
          </span>
          <span className="block text-[50px]">ENTER YOUR EMAIL TO GET STARTED</span>
        </h1>
        <p className={`
         ${poppins.className}text-sm text-white/65 mb-10`}>
          Sign in to access your dashboard and continue forecasting wind energy.
        </p>

        {/* USERNAME */}
        <div className="mb-5 px-6">
          <label className="block text-sm font-medium text-white/80 mb-2">
            Username
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 z-10">
              <User className="w-4 h-4"/>
            </div>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full py-3.5 pl-12 pr-5 rounded-xl border border-white/10 bg-white/20 backdrop-blur-md text-white placeholder:text-white/60 outline-none transition-all duration-300 focus:border-emerald-200/40 focus:bg-white/15 text-sm"
            />
          </div>
        </div>

        {/* PASSWORD */}
        <div className="mb-2 px-6">
          <label className="block text-sm font-medium text-white/80 mb-2">
            Password
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 z-10">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-3.5 pl-12 pr-12 rounded-xl border border-white/10 bg-white/20 backdrop-blur-md text-white placeholder:text-white/60 outline-none transition-all duration-300 focus:border-emerald-200/40 focus:bg-white/15 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white/80 transition-colors"
            >
              {showPassword ? (
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
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* FORGOT PASSWORD */}
        <div className="text-right mb-7 mr-8">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-white/65 hover:text-white transition-colors"
          >
            Forgot Password?
          </button>
        </div>
{/*         
        <div className="mb-6 flex justify-center">
          <div className="scale-110 origin-center">
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
              ref={captchaRef}
              theme="dark"
            />
          </div>
        </div> */}

        {/* BUTTON */}
        <button
          type="submit"
          className="group relative px-38 py-3.5 ml-6 rounded-xl bg-white text-[#163832] font-semibold text-sm overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:bg-[#f4fffb] active:scale-[0.98] shadow-[0_10px_30px_rgba(255,255,255,0.12)]"
        >
          <span className="relative z-10 inline-block px-20">Login</span>
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-black/5 to-transparent" />
        </button>

        {/* DIVIDER */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/40">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* FOOTER */}
        <p className="text-center text-sm text-white/65">
          Don&apos;t have an Account?{" "}
          <button
            type="button"
            onClick={onSwitch}
            className="text-white font-bold hover:underline"
          >
            Register
          </button>
        </p>
      </form>
    </div>
  );
}
