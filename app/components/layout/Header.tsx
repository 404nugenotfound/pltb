export default function Header() {
  return (
    <div
      className="
        sticky
        top-0
        z-50
        bg-white
        border-b
        border-gray-200
        px-8
        py-6
      "
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center">
          <img src="/icon/icon-angin.svg" className="w-6 h-6" alt="" />
        </div>

        <div className="ml-3 cursor-default">
          <h1 className="text-xl font-bold text-teal-700">
            Sistem Peramalan Energi Angin
          </h1>

          <p className="text-sm text-gray-600">
            Optimasi Pengaturan Pembebanan PLTB
          </p>
        </div>
      </div>
    </div>
  );
}
