"use client";

import { Bebas_Neue } from "next/font/google";
import { poppins } from "@/app/fonts";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});


interface Props {
  onStart: () => void;
}

export default function LandingPanel({ onStart }: Props) {
  return (
    <div
      className="
        relative
        w-full
        h-full

        flex
        items-center
        justify-center

        overflow-hidden
        px-14

        bg-[linear-gradient(135deg,#163832_0%,#1f4d45_28%,#2d6a5f_58%,#3f8f7f_100%)]
      "
    >
      {/* BIG SOFT GLOW */}
      <div
        className="
          absolute
          -top-45
          -left-30

          w-120
          h-120

          rounded-full
           bg-emerald-100/23

          blur-[120px]
        "
      />

      {/* BOTTOM GLOW */}
      <div
        className="
          absolute
          -bottom-45
          -right-25

          w-105
          h-105

          rounded-full
          bg-emerald-300/20

          blur-[120px]
        "
      />

      {/* GRID */}
      <div
        className="
          absolute
          inset-0
          opacity-[0.05]

          bg-[linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px)]
          bg-size-[52px_52px]
        "
      />

      {/* CONTENT */}
      <div
        className="
          relative
          z-10
          max-w-140
          -mt-12
        "
      >
        {/* TITLE */}
        <h1
          className={`
            ${bebasNeue.className}
            leading-[0.9]
            tracking-[2px]
            text-white
            uppercase
            text-left
            drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]
            mb-6
        `}
        >
          <span className="block text-[80px]">TOMORROW'S ENERGY</span>
          <span className="block text-[74px]">
            PREDICTED TODAY{" "}
            <span className="inline-block w-16 h-2 rounded-full mb-6 bg-white" />
          </span>
        </h1>

        {/* DESCRIPTION */}
        <p
          className={`
            ${poppins.className}
            text-[17px]
            leading-loose

             text-white
             text-justify

            max-w-150
            mb-14
          `}
        >
          Upload datasets, train models, and generate accurate forecasts.{" "}
          <b>VENTARA</b> delivers AI-powered energy insights in real time
          through a seamless digital experience.
        </p>

        {/* FEATURES */}
        <div
          className="
            flex
            flex-wrap
            gap-3

            mb-10
          "
        >
          {[
            "Real-time Analytics",
            "AI Forecasting",
            "Environmental Monitoring",
          ].map((f) => (
            <div
              key={f}
              className="
                px-5
                py-2.5
                ml-1

                rounded-2xl

                bg-white/30
                border border-white/15

                backdrop-blur-lg

                text-white
                text-sm
                font-medium

                shadow-[0_8px_24px_rgba(0,0,0,0.05)]
              "
            >
              {f}
            </div>
          ))}
        </div>

        {/* BUTTON */}
        <button
          onClick={onStart}
          className="
            group
            relative
            overflow-hidden

            px-10
            py-4
            mt-12
            ml-42

            rounded-4xl

            bg-[#1e504c]

            text-white
            font-semibold
            text-[18px]

            shadow-[0_14px_35px_rgba(16,60,56,0.28)]

            transition-all
            duration-300

            hover:scale-[1.03]
            hover:bg-[#0f2d2b]
            hover:shadow-[0_18px_45px_rgba(16,60,56,0.35)]

            active:scale-[0.98]
          "
        >
          <span
            className="
              relative
              z-10

              flex
              items-center
              gap-3
              tracking-wider
            "
          >
            Let's Get Started
          </span>

          {/* SHINE */}
          <div
            className="
              absolute
              inset-0

              -translate-x-full
              group-hover:translate-x-full

              transition-transform
              duration-1000

              bg-linear-to-r
              from-transparent
              via-white/20
              to-transparent
            "
          />
        </button>
      </div>
      {/* FOOTER */}
      <div className={`
      absolute bottom-6 left-64 right-0 px-12 flex items-center justify-between z-10
      ${poppins.className}`}>
        <img
          src="/icon/logo-ventara-white.svg"
          className="h-9"
          alt="Ventara"
        />
        <div className="flex items-center gap-2 text-white text-[13px]">
          <span>Terms</span>
          <span>·</span>
          <span>Contact</span>
          <span className="ml-2">© 2025 VENTARA</span>
        </div>
      </div>
    </div>
  );
}
