import pandas as pd

# Label per variabel
VAR_LABELS = {
    "WS10M": {
        "nama": "kecepatan angin",
        "satuan": "m/s",
        "kategori": lambda avg: (
            "tenang (calm)"
            if avg < 1.5
            else (
                "angin sepoi ringan"
                if avg < 3.3
                else (
                    "angin sedang"
                    if avg < 5.5
                    else "angin segar" if avg < 8.0 else "angin kencang"
                )
            )
        ),
    },
    "RH2M": {
        "nama": "kelembaban udara",
        "satuan": "%",
        "kategori": lambda avg: (
            "sangat kering"
            if avg < 30
            else (
                "kering"
                if avg < 50
                else "nyaman" if avg < 70 else "lembab" if avg < 85 else "sangat lembab"
            )
        ),
    },
    "WD10M": {
        "nama": "arah angin",
        "satuan": "derajat",
        "kategori": lambda avg: (
            "dari utara"
            if avg < 45
            else (
                "dari timur laut"
                if avg < 90
                else (
                    "dari timur"
                    if avg < 135
                    else (
                        "dari tenggara"
                        if avg < 180
                        else (
                            "dari selatan"
                            if avg < 225
                            else (
                                "dari barat daya"
                                if avg < 270
                                else "dari barat" if avg < 315 else "dari barat laut"
                            )
                        )
                    )
                )
            )
        ),
    },
    "T2M": {
        "nama": "suhu udara",
        "satuan": "°C",
        "kategori": lambda avg: (
            "sangat dingin"
            if avg < 18
            else (
                "sejuk"
                if avg < 24
                else "nyaman" if avg < 28 else "panas" if avg < 33 else "sangat panas"
            )
        ),
    },
    "PS": {
        "nama": "tekanan atmosfer",
        "satuan": "kPa",
        "kategori": lambda avg: (
            "rendah" if avg < 99 else "normal" if avg < 103 else "tinggi"
        ),
    },
}


def _get_label(var: str):
    return VAR_LABELS.get(
        var, {"nama": var, "satuan": "", "kategori": lambda avg: "normal"}
    )


def get_best_ml_and_dl(m_ml: dict, m_dl: dict) -> list:
    if not m_ml:
        return []
    best_ml = min(
        m_ml, key=lambda m: m_ml[m].get("primary_value", m_ml[m].get("sMAPE", 999))
    )
    result = [best_ml]
    if m_dl:
        best_dl = min(
            m_dl, key=lambda m: m_dl[m].get("primary_value", m_dl[m].get("sMAPE", 999))
        )
        result.append(best_dl)
    return result


def build_forecast_text(df_future: pd.DataFrame, var: str) -> dict:
    label = _get_label(var)
    avg = float(df_future[var].mean())
    max_val = float(df_future[var].max())
    min_val = float(df_future[var].min())
    std_val = float(df_future[var].std())

    hourly = df_future.groupby("HR")[var].mean()
    peak_hr = int(hourly.idxmax())
    low_hr = int(hourly.idxmin())

    start_row = df_future.iloc[0]
    end_row = df_future.iloc[-1]
    start_date = f"{int(start_row['DY']):02d}-{int(start_row['MO']):02d}-{int(start_row['YEAR'])}"
    end_date = (
        f"{int(end_row['DY']):02d}-{int(end_row['MO']):02d}-{int(end_row['YEAR'])}"
    )

    split_idx = len(df_future) // 2
    first_half = float(df_future.iloc[:split_idx][var].mean())
    second_half = float(df_future.iloc[split_idx:][var].mean())

    if second_half > first_half + 0.1:
        trend = "meningkat menuju akhir periode"
    elif second_half < first_half - 0.1:
        trend = "menurun menuju akhir periode"
    else:
        trend = "relatif stabil sepanjang periode"

    return {
        "avg": avg,
        "max_val": max_val,
        "min_val": min_val,
        "std_val": std_val,
        "peak_hr": peak_hr,
        "low_hr": low_hr,
        "trend": trend,
        "category": label["kategori"](avg),
        "start_date": start_date,
        "end_date": end_date,
        "nama": label["nama"],
        "satuan": label["satuan"],
    }


def generate_nlp_report(stats: dict, best_model_name: str, best_met: dict) -> str:
    """NLP report untuk satu variabel — dipakai di Generate General."""
    smape_raw = (
        str(best_met.get("sMAPE", "-")).replace(",", ".").replace("%", "").strip()
    )
    rmse_raw = str(best_met.get("RMSE", "-")).replace(",", ".").strip()
    mae_raw = str(best_met.get("MAE", "-")).replace(",", ".").strip()
    r2_raw = str(best_met.get("R2", "-")).replace(",", ".").strip()

    if smape_raw.lower() in ("-", "", "nan", "none"):
        smape_str = "N/A"
        akurasi = "tidak tersedia"
    else:
        smape = float(smape_raw)
        smape_str = f"{smape:.2f}%"
        akurasi = "tinggi" if smape < 10 else "cukup" if smape < 20 else "rendah"

    rmse_str = "N/A" if rmse_raw.lower() in ("-", "", "nan", "none") else rmse_raw
    mae_str = "N/A" if mae_raw.lower() in ("-", "", "nan", "none") else mae_raw
    r2_str = "N/A" if r2_raw.lower() in ("-", "", "nan", "none") else r2_raw

    nama = stats.get("nama", "nilai")
    satuan = stats.get("satuan", "")
    avg = stats["avg"]

    # Interpretasi kontekstual
    if nama == "kecepatan angin":
        if avg < 1.5:
            konteks = "Kondisi ini kurang ideal untuk operasional PLTB karena berada di bawah cut-in speed turbin."
        elif avg < 3.3:
            konteks = "Kecepatan angin rendah, hanya cocok untuk turbin skala kecil dengan efisiensi terbatas."
        elif avg < 5.5:
            konteks = "Kecepatan angin sedang, cukup untuk turbin skala menengah dengan efisiensi memadai."
        elif avg < 8.0:
            konteks = "Kecepatan angin segar, mendukung operasional PLTB dengan potensi produksi energi yang baik."
        else:
            konteks = "Kecepatan angin kencang, sangat mendukung produksi energi optimal pada PLTB."
    elif nama == "kelembaban udara":
        if avg < 70:
            konteks = "Kelembaban udara dalam kisaran aman dan tidak memberikan dampak signifikan terhadap operasional turbin."
        else:
            konteks = "Kelembaban tinggi perlu diperhatikan karena berpotensi mempercepat korosi pada komponen turbin."
    elif nama == "arah angin":
        konteks = (
            f"Arah angin dominan {stats['category']} ({avg:.1f}°), "
            f"penting untuk kalibrasi yaw control dan optimasi layout PLTB."
        )
    elif nama == "suhu udara":
        konteks = (
            f"Suhu udara rata-rata {avg:.1f}°C tergolong {stats['category']}. "
            f"Suhu berpengaruh pada densitas udara yang mempengaruhi efisiensi turbin angin."
        )
    elif nama == "tekanan atmosfer":
        konteks = (
            f"Tekanan atmosfer rata-rata {avg:.2f} kPa tergolong {stats['category']}. "
            f"Tekanan udara mempengaruhi densitas udara dan performa operasional turbin."
        )
    else:
        konteks = f"Nilai {nama} berada pada kisaran normal untuk wilayah pengamatan."

    # Build performa string per variabel
    try:
        r2 = float(r2_raw)
        r2_interp = "sangat baik" if r2 >= 0.95 else "baik" if r2 >= 0.85 else "cukup"
    except:
        r2_interp = "tidak tersedia"

    if nama == "arah angin":
        circular_mae = str(best_met.get("CircularMAE", "N/A"))
        circular_mae_pct = str(best_met.get("CircularMAE_pct", "N/A"))
        performa_str = (
            f"CircularMAE **{circular_mae}°** ({circular_mae_pct}%), "
            f"RMSE {rmse_str} {satuan}, R² {r2_str} ({r2_interp})"
        )
        akurasi_val = best_met.get("CircularMAE_pct", 999)
        try:
            akurasi = (
                "tinggi"
                if float(akurasi_val) < 5
                else "cukup" if float(akurasi_val) < 15 else "rendah"
            )
        except:
            akurasi = "tidak tersedia"
    elif nama == "tekanan atmosfer" or nama == "suhu udara" or nama == "kelembaban udara":
        performa_str = (
            f"MAE {mae_str} {satuan}, RMSE {rmse_str} {satuan}, R² {r2_str} ({r2_interp})"
        )
        try:
            akurasi = "tinggi" if float(mae_raw) < 2 else "cukup" if float(mae_raw) < 5 else "rendah"
        except:
            akurasi = "tidak tersedia"
    else:
        performa_str = (
            f"MAE {mae_str} {satuan}, RMSE {rmse_str} {satuan}, "
            f"sMAPE {smape_str}, R² {r2_str} ({r2_interp})"
        )

    return (
        f"Ringkasan prediksi {nama} untuk periode "
        f"{stats['start_date']} hingga {stats['end_date']}:\n"
        f"\n"
        f"▸ Statistik: rata-rata {stats['avg']:.2f} {satuan} ({stats['category']}), "
        f"tertinggi {stats['max_val']:.2f} {satuan}, terendah {stats['min_val']:.2f} {satuan}, "
        f"standar deviasi {stats['std_val']:.2f} {satuan}. "
        f"Rentang nilai harian mencapai {stats['max_val'] - stats['min_val']:.2f} {satuan}.\n"
        f"\n"
        f"▸ Pola harian: puncak sekitar pukul {stats['peak_hr']:02d}:00, "
        f"lembah sekitar pukul {stats['low_hr']:02d}:00. "
        f"Tren {stats['trend']}.\n"
        f"\n"
        f"▸ Analisis: {konteks} "
        f"Pemantauan berkala tetap disarankan untuk mengantisipasi perubahan kondisi atmosfer "
        f"yang dapat mempengaruhi kinerja sistem.\n"
        f"\n"
        f"▸ Performa model: {best_model_name} — "
        f"{performa_str}. "
        f"Model mampu menjelaskan variasi data dengan kemampuan {r2_interp}. "
        f"Akurasi keseluruhan tergolong {akurasi}."
    )


def generate_nlp_report_best(
    stats_per_var: dict,  # {"WS10M": stats_dict, "RH2M": stats_dict, "WD10M": stats_dict}
    best_per_var: dict,  # {"WS10M": ("GBR", {"sMAPE":..,"RMSE":..}), ...}
) -> str:
    """
    ✅ NLP report untuk Generate Best — merangkum ketiga variabel sekaligus.
    stats_per_var : hasil build_forecast_text per variabel
    best_per_var  : model terbaik dan metriknya per variabel
    """
    # Ambil periode dari variabel pertama yang ada
    first_stats = next(iter(stats_per_var.values()))
    start_date = first_stats["start_date"]
    end_date = first_stats["end_date"]

    lines = [
        f"Ringkasan prediksi cuaca untuk periode {start_date} hingga {end_date}:\n"
    ]

    mape_list = []

    for var, stats in stats_per_var.items():
        nama = stats.get("nama", var)
        satuan = stats.get("satuan", "")

        best_name, best_met = best_per_var.get(var, ("N/A", {}))

        pm = best_met.get("primary_metric", "sMAPE")
        pv_raw = (
            str(best_met.get("primary_value", best_met.get("sMAPE", "-")))
            .replace(",", ".")
            .replace("%", "")
            .strip()
        )
        rmse_raw = str(best_met.get("RMSE", "-")).replace(",", ".").strip()

        if pv_raw.lower() in ("-", "", "nan", "none"):
            pv_str = "N/A"
            akurasi = "tidak tersedia"
        else:
            pv = float(pv_raw)
            pv_str = f"{pv:.2f}%"
            # ← fix threshold per primary metric
            if pm == "CircularMAE":
                akurasi = "tinggi" if pv < 5 else "cukup" if pv < 15 else "rendah"
            else:
                akurasi = "tinggi" if pv < 10 else "cukup" if pv < 20 else "rendah"
            mape_list.append(pv)

        rmse_str = "N/A" if rmse_raw.lower() in ("-", "", "nan", "none") else rmse_raw

        lines.append(
            f"▸ {nama.capitalize()} ({var}): "
            f"rata-rata **{stats['avg']:.2f} {satuan}**, "
            f"kategori **{stats['category']}**, "
            f"tren {stats['trend']}. "
            f"Tertinggi **{stats['max_val']:.2f} {satuan}**, "
            f"terendah **{stats['min_val']:.2f} {satuan}**. "
            f"Puncak pukul **{stats['peak_hr']:02d}:00**, "
            f"terendah pukul **{stats['low_hr']:02d}:00**. "
            f"Model: **{best_name}** | {pm} **{pv_str}** | RMSE **{rmse_str}** "
            f"(akurasi **{akurasi}**).\n"
        )

    # Rata-rata sMAPE keseluruhan
    if mape_list:
        avg_pv = sum(mape_list) / len(mape_list)
        avg_akurasi = "tinggi" if avg_pv < 10 else "cukup" if avg_pv < 20 else "rendah"
        lines.append(
            f"\nRata-rata error keseluruhan: **{avg_pv:.2f}%** "
            f"— tingkat akurasi prediksi tergolong **{avg_akurasi}** "
            f"(CircularMAE untuk arah angin, MAE/sMAPE untuk variabel lain)."
        )

    return "\n".join(lines)
