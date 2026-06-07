import pandas as pd

# Label per variabel
VAR_LABELS = {
    "WS10M": {
        "nama":   "kecepatan angin",
        "satuan": "m/s",
        "kategori": lambda avg: (
            "tenang (calm)"      if avg < 1.5 else
            "angin sepoi ringan" if avg < 3.3 else
            "angin sedang"       if avg < 5.5 else
            "angin segar"        if avg < 8.0 else
            "angin kencang"
        )
    },
    "RH2M": {
        "nama":   "kelembaban udara",
        "satuan": "%",
        "kategori": lambda avg: (
            "sangat kering" if avg < 30 else
            "kering"        if avg < 50 else
            "nyaman"        if avg < 70 else
            "lembab"        if avg < 85 else
            "sangat lembab"
        )
    },
    "WD10M": {
        "nama":   "arah angin",
        "satuan": "derajat",
        "kategori": lambda avg: (
            "dari utara"    if avg < 45  else
            "dari timur laut" if avg < 90  else
            "dari timur"    if avg < 135 else
            "dari tenggara" if avg < 180 else
            "dari selatan"  if avg < 225 else
            "dari barat daya" if avg < 270 else
            "dari barat"    if avg < 315 else
            "dari barat laut"
        )
    },
}

def _get_label(var: str):
    return VAR_LABELS.get(var, {
        "nama":     var,
        "satuan":   "",
        "kategori": lambda avg: "normal"
    })

def get_best_ml_and_dl(m_ml: dict, m_dl: dict) -> list:
    if not m_ml:
        return []
    best_ml = min(m_ml, key=lambda m: m_ml[m]["MAPE"])
    result  = [best_ml]
    if m_dl:
        best_dl = min(m_dl, key=lambda m: m_dl[m]["MAPE"])
        result.append(best_dl)
    return result

def build_forecast_text(df_future: pd.DataFrame, var: str) -> dict:
    label   = _get_label(var)
    avg     = float(df_future[var].mean())
    max_val = float(df_future[var].max())
    min_val = float(df_future[var].min())
    std_val = float(df_future[var].std())

    hourly  = df_future.groupby("HR")[var].mean()
    peak_hr = int(hourly.idxmax())
    low_hr  = int(hourly.idxmin())

    start_row  = df_future.iloc[0]
    end_row    = df_future.iloc[-1]
    start_date = f"{int(start_row['DY']):02d}-{int(start_row['MO']):02d}-{int(start_row['YEAR'])}"
    end_date   = f"{int(end_row['DY']):02d}-{int(end_row['MO']):02d}-{int(end_row['YEAR'])}"

    split_idx   = len(df_future) // 2
    first_half  = float(df_future.iloc[:split_idx][var].mean())
    second_half = float(df_future.iloc[split_idx:][var].mean())

    if second_half > first_half + 0.1:
        trend = "meningkat menuju akhir periode"
    elif second_half < first_half - 0.1:
        trend = "menurun menuju akhir periode"
    else:
        trend = "relatif stabil sepanjang periode"

    return {
        "avg":        avg,
        "max_val":    max_val,
        "min_val":    min_val,
        "std_val":    std_val,
        "peak_hr":    peak_hr,
        "low_hr":     low_hr,
        "trend":      trend,
        "category":   label["kategori"](avg),
        "start_date": start_date,
        "end_date":   end_date,
        "nama":       label["nama"],
        "satuan":     label["satuan"],
    }

def generate_nlp_report(stats: dict, best_model_name: str, best_met: dict) -> str:
    """NLP report untuk satu variabel — dipakai di Generate General."""
    mape_raw = str(best_met.get("MAPE", "-")).replace(",", ".").replace("%", "").strip()
    rmse_raw = str(best_met.get("RMSE", "-")).replace(",", ".").strip()

    if mape_raw.lower() in ("-", "", "nan", "none"):
        mape_str = "N/A"
        akurasi  = "tidak tersedia"
    else:
        mape     = float(mape_raw)
        mape_str = f"{mape:.2f}%"
        akurasi  = "tinggi" if mape < 10 else "cukup" if mape < 20 else "rendah"

    rmse_str = "N/A" if rmse_raw.lower() in ("-", "", "nan", "none") else rmse_raw
    nama     = stats.get("nama",   "nilai")
    satuan   = stats.get("satuan", "")

    return (
        f"Prediksi {nama} untuk periode "
        f"{stats['start_date']} hingga {stats['end_date']} "
        f"menunjukkan rata-rata {stats['avg']:.2f} {satuan}, "
        f"termasuk kategori {stats['category']}. "
        f"Nilai tertinggi mencapai {stats['max_val']:.2f} {satuan} "
        f"dan terendah {stats['min_val']:.2f} {satuan}, "
        f"dengan standar deviasi {stats['std_val']:.2f} {satuan}. "
        f"Nilai cenderung paling tinggi sekitar pukul {stats['peak_hr']:02d}:00 "
        f"dan paling rendah sekitar pukul {stats['low_hr']:02d}:00. "
        f"Secara umum tren {nama} {stats['trend']}. "
        f"\n\nModel terbaik adalah {best_model_name} "
        f"dengan MAPE {mape_str} dan RMSE {rmse_str}. "
        f"Tingkat akurasi model tergolong {akurasi}."
    )


def generate_nlp_report_best(
    stats_per_var: dict,   # {"WS10M": stats_dict, "RH2M": stats_dict, "WD10M": stats_dict}
    best_per_var:  dict,   # {"WS10M": ("GBR", {"MAPE":..,"RMSE":..}), ...}
) -> str:
    """
    ✅ NLP report untuk Generate Best — merangkum ketiga variabel sekaligus.
    stats_per_var : hasil build_forecast_text per variabel
    best_per_var  : model terbaik dan metriknya per variabel
    """
    # Ambil periode dari variabel pertama yang ada
    first_stats = next(iter(stats_per_var.values()))
    start_date  = first_stats["start_date"]
    end_date    = first_stats["end_date"]

    lines = [
        f"Ringkasan prediksi cuaca untuk periode {start_date} hingga {end_date}:\n"
    ]

    mape_list = []

    for var, stats in stats_per_var.items():
        nama   = stats.get("nama",   var)
        satuan = stats.get("satuan", "")

        best_name, best_met = best_per_var.get(var, ("N/A", {}))

        mape_raw = str(best_met.get("MAPE", "-")).replace(",", ".").replace("%", "").strip()
        rmse_raw = str(best_met.get("RMSE", "-")).replace(",", ".").strip()

        if mape_raw.lower() in ("-", "", "nan", "none"):
            mape_str = "N/A"
            akurasi  = "tidak tersedia"
        else:
            mape     = float(mape_raw)
            mape_str = f"{mape:.2f}%"
            akurasi  = "tinggi" if mape < 10 else "cukup" if mape < 20 else "rendah"
            mape_list.append(mape)

        rmse_str = "N/A" if rmse_raw.lower() in ("-", "", "nan", "none") else rmse_raw

        lines.append(
            f"▸ {nama.capitalize()} ({var}): "
            f"rata-rata {stats['avg']:.2f} {satuan}, "
            f"kategori {stats['category']}, "
            f"tren {stats['trend']}. "
            f"Tertinggi {stats['max_val']:.2f} {satuan}, "
            f"terendah {stats['min_val']:.2f} {satuan}. "
            f"Puncak pukul {stats['peak_hr']:02d}:00, "
            f"terendah pukul {stats['low_hr']:02d}:00. "
            f"Model: {best_name} | MAPE {mape_str} | RMSE {rmse_str} "
            f"(akurasi {akurasi}).\n"
        )

    # Rata-rata MAPE keseluruhan
    if mape_list:
        avg_mape     = sum(mape_list) / len(mape_list)
        avg_akurasi  = "tinggi" if avg_mape < 10 else "cukup" if avg_mape < 20 else "rendah"
        lines.append(
            f"\nRata-rata MAPE keseluruhan: {avg_mape:.2f}% "
            f"— tingkat akurasi prediksi tergolong {avg_akurasi}."
        )

    return "\n".join(lines)