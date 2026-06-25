import localFont from "next/font/local";

export const poppins = localFont({
  src: [
    { path: "./fonts/poppins-v24-latin-100.woff2", weight: "100", style: "normal" },
    { path: "./fonts/poppins-v24-latin-100italic.woff2", weight: "100", style: "italic" },
    { path: "./fonts/poppins-v24-latin-200.woff2", weight: "200", style: "normal" },
    { path: "./fonts/poppins-v24-latin-200italic.woff2", weight: "200", style: "italic" },
    { path: "./fonts/poppins-v24-latin-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/poppins-v24-latin-300italic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/poppins-v24-latin-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-v24-latin-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/poppins-v24-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-v24-latin-500italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/poppins-v24-latin-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-v24-latin-600italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/poppins-v24-latin-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-v24-latin-700italic.woff2", weight: "700", style: "italic" },
    { path: "./fonts/poppins-v24-latin-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/poppins-v24-latin-800italic.woff2", weight: "800", style: "italic" },
    { path: "./fonts/poppins-v24-latin-900.woff2", weight: "900", style: "normal" },
    { path: "./fonts/poppins-v24-latin-900italic.woff2", weight: "900", style: "italic" },
  ],
  variable: "--font-poppins",
  display: "swap",
});