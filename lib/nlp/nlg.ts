// lib/nlp/nlg.ts
// Natural Language Generation — Stage 4 dalam pipeline NLP
// Input : AnalysisResult + WeatherToken[]
// Output: NlgResult (narrative, keyPhrase, sentences)
//
// Mengubah hasil analysis menjadi narasi bahasa Indonesia yang natural
// dengan variasi gaya bicara per kondisi & mood.

import type { WeatherToken } from "./tokenizing";
import type { StemmedWeather, StemmedConcept } from "./stemming";
import type { AnalysisResult, TfIdfTerm } from "./analysis";
import type { DerivedInsight } from "./reasoning";

// ─── Tipe output ─────────────────────────────────────────────────────────────

export interface NlgSentence {
  type: "opening" | "condition" | "wind" | "rain" | "uv" | "advice" | "closing";
  text: string;
  weight: number;
}

export interface NlgResult {
  sentences: NlgSentence[];
  narrative: string;
  keyPhrase: string;
}

// ─── Peta weatherPrimary (slug) → label Bahasa Indonesia ────────────────────

const WX_LABEL_ID: Record<string, string> = {
  sunny: "Cerah",
  mostly_sunny: "Cerah Berawan",
  partly_cloudy: "Berawan Sebagian",
  mostly_cloudy: "Banyak Awan",
  cloudy: "Mendung",
  overcast: "Langit Tertutup Awan",
  fog: "Berkabut",
  haze: "Berkabut Tipis",
  clear: "Cerah",
  rain: "Hujan",
  showers: "Hujan Singkat",
  light_rain: "Hujan Ringan",
  heavy_rain: "Hujan Lebat",
  drizzle: "Gerimis",
  thunderstorm: "Badai Petir",
  snow: "Bersalju",
  sleet: "Hujan Es",
  freezing_rain: "Hujan Beku",
  blizzard: "Badai Salju",
  windy: "Berangin",
  dust: "Berdebu",
  smoke: "Berasap",
  tornado: "Tornado",
  tropical_storm: "Badai Tropis",
  hurricane: "Badai Angin",
  light_rain_showers: "Gerimis Singkat",
  chance_of_showers: "Kemungkinan Hujan",
  chance_of_rain: "Kemungkinan Hujan",
  chance_of_thunderstorm: "Kemungkinan Badai",
  isolated_thunderstorms: "Badai Petir Tersebar",
  scattered_thunderstorms: "Badai Petir Menyebar",
  scattered_showers: "Hujan Tersebar",
  isolated_showers: "Hujan Singkat",
};

function wxLabelId(slug: string): string {
  const clean = slug.startsWith("kondisi_") ? slug.slice(8) : slug;
  if (WX_LABEL_ID[clean]) return WX_LABEL_ID[clean];
  const normalized = clean.toLowerCase().replace(/\s+/g, "_");
  if (WX_LABEL_ID[normalized]) return WX_LABEL_ID[normalized];
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Lokasi ──────────────────────────────────────────────────────────────────

function humanLocation(raw: string): string {
  const trimmed = raw.trim();
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(trimmed)) return "";
  return trimmed
    .replace(/_/g, ", ")
    .split(", ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(", ");
}

// ─── Seed utilities ──────────────────────────────────────────────────────────

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seedFromTokens(location: string, tokens: WeatherToken[]): number {
  const getNum = (key: string): number => {
    const t = tokens.find((tk) => tk.key === key);
    return t ? Math.round(Number(t.rawValue) * 10) : 0;
  };
  const getStr = (key: string): string => {
    const t = tokens.find((tk) => tk.key === key);
    return t ? String(t.rawValue) : "";
  };

  const fingerprint = [
    location,
    getStr("weather_primary"),
    getNum("temp_c"),
    getNum("humidity_pct"),
    getNum("pop_pct"),
    getNum("uvi"),
    getNum("precip_mm"),
    getNum("wind_speed_kph"),
    getNum("visibility_km"),
  ].join("|");

  return seedFrom(fingerprint);
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

// ─── Template types ──────────────────────────────────────────────────────────

type TemplateArgs = {
  location: string;
  hasLocation: boolean;
  tempC?: number;
  humidity?: number;
  windSpeed?: number;
  windDir?: string;
  windGust?: number;
  uvi?: number;
  visKm?: number;
  pop?: number;
  precipMm?: number;
  wxLabel?: string;
  seed: number;
};

function lokasi(a: TemplateArgs): string {
  return a.hasLocation ? a.location : "Hari ini";
}

function wx(a: TemplateArgs): string {
  return (a.wxLabel ?? "berawan").toLowerCase();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Template banks ──────────────────────────────────────────────────────────

const OPENING_BAIK: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `${lokasi(a)} ${wx(a)} dengan suhu ${a.tempC?.toFixed(0)}°C, kondisi ideal untuk aktivitas di luar.`,
  (a) =>
    `${cap(wx(a))} menemani ${a.hasLocation ? a.location : "hari ini"}, suhu ${a.tempC?.toFixed(0)}°C terasa nyaman.`,
  (a) =>
    `Cuaca ${a.hasLocation ? a.location : "hari ini"} bersahabat di ${a.tempC?.toFixed(0)}°C. Langit mendukung penuh aktivitasmu.`,
  (a) =>
    `${a.hasLocation ? a.location : "Cuaca hari ini"} menikmati ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Hari yang bagus untuk keluar.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C, langit ${wx(a)} — perpaduan yang pas untuk memulai hari ${a.hasLocation ? `di ${a.location}` : "dengan baik"}.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C dan kondisi ${wx(a)} saling melengkapi. ${a.hasLocation ? a.location : "Cuaca hari ini"} sedang berada di versi terbaiknya.`,
  (a) =>
    `Nggak perlu khawatir soal cuaca ${a.hasLocation ? `${a.location} hari ini` : "hari ini"}. ${cap(wx(a))}, suhu ${a.tempC?.toFixed(0)}°C, semuanya terkendali.`,
  (a) =>
    `Hari yang cerah ${a.hasLocation ? `menanti di ${a.location}` : ""}, ${a.tempC?.toFixed(0)}°C dengan ${wx(a)}. Langit seolah setuju dengan rencana-rencanamu.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C, ${wx(a)}, dan angin yang bersahabat — kombinasi yang sulit dikalahkan.`,
  (a) =>
    `${cap(wx(a))} ${a.hasLocation ? `di ${a.location}` : ""} bikin hari ini terasa ringan. Suhu ${a.tempC?.toFixed(0)}°C, udara pas, nggak ada yang perlu dikeluhkan.`,
];

const OPENING_WASPADA: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `${lokasi(a)} ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Perhatikan perkembangan cuaca sebelum keluar.`,
  (a) =>
    `${cap(wx(a))} ${a.hasLocation ? `di ${a.location}` : "hari ini"}, suhu ${a.tempC?.toFixed(0)}°C. Ada beberapa hal yang perlu dicermati.`,
  (a) =>
    `Cuaca ${a.hasLocation ? a.location : "hari ini"} di ${a.tempC?.toFixed(0)}°C perlu sedikit perhatian ekstra.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C, ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Tidak berbahaya, tapi jangan lengah.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C dengan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : ""}. Kelihatannya biasa aja, tapi ada beberapa parameter yang perlu diwaspadai.`,
  (a) =>
    `Secara umum ${a.hasLocation ? a.location : "cuaca"} masih oke di ${a.tempC?.toFixed(0)}°C, cuma ada beberapa kondisi yang kurang ideal. Cek detailnya sebelum keluar.`,
  (a) =>
    `${a.hasLocation ? a.location : "Hari ini"} sedang tidak sepenuhnya bersahabat. Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)}, dan beberapa indikator perlu diantisipasi.`,
  (a) =>
    `Ada sedikit gangguan cuaca ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)} — bukan masalah besar, tapi tetap siap-siaga.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C, langit ${wx(a)}. Kondisi masih bisa ditoleransi, tapi beberapa parameter menunjukkan potensi risiko ringan.`,
  (a) =>
    `Cuaca ${a.hasLocation ? a.location : "hari ini"} ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Lumayan, tapi ada beberapa catatan yang perlu diperhatikan.`,
];

const OPENING_BERBAHAYA: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `⚠ ${a.hasLocation ? a.location : "Cuaca"} sedang tidak bersahabat. ${cap(wx(a))} di ${a.tempC?.toFixed(0)}°C. Tunda aktivitas luar ruangan.`,
  (a) =>
    `${a.hasLocation ? a.location : "Kondisi cuaca"} berbahaya di ${a.tempC?.toFixed(0)}°C. Tetap di dalam jika tidak mendesak.`,
  (a) =>
    `⚠ Waspada penuh ${a.hasLocation ? `di ${a.location}` : "hari ini"}. ${cap(wx(a))}, ${a.tempC?.toFixed(0)}°C, risiko nyata di luar.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C dan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Bukan saat yang tepat untuk beraktivitas di luar.`,
  (a) =>
    `⚠ Jangan anggap remeh cuaca ${a.hasLocation ? a.location : "hari ini"}. ${cap(wx(a))} di ${a.tempC?.toFixed(0)}°C — lebih baik aman daripada menyesal.`,
  (a) =>
    `Situasi cuaca ${a.hasLocation ? a.location : "hari ini"} cukup genting. ${a.tempC?.toFixed(0)}°C dengan ${wx(a)} bukan kombinasi yang bisa diabaikan.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C dan ${wx(a)} adalah perpaduan yang tidak bersahabat. Kalau tidak ada keperluan mendesak, lebih baik bertahan di dalam.`,
  (a) =>
    `⚠ Risiko nyata ${a.hasLocation ? `di ${a.location}` : "hari ini"}: ${wx(a)}, suhu ${a.tempC?.toFixed(0)}°C. Alam sedang tidak berpihak pada aktivitas luar ruangan.`,
  (a) =>
    `${a.hasLocation ? a.location : "Cuaca"} sedang menunjukkan sisi terburuknya. ${a.tempC?.toFixed(0)}°C, ${wx(a)} — ini bukan hari yang bersahabat.`,
  (a) =>
    `Prioritas utama ${a.hasLocation ? `di ${a.location}` : "hari ini"} adalah keselamatan. Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)}, risiko di luar cukup nyata.`,
];

const OPENING_CUKUP: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `${lokasi(a)} ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Lumayan untuk aktivitas ringan.`,
  (a) =>
    `Cuaca ${a.hasLocation ? a.location : "hari ini"} cukup biasa, ${a.tempC?.toFixed(0)}°C. Tidak istimewa, tapi tidak mengkhawatirkan.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C dengan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Nyaman untuk kegiatan sehari-hari.`,
  (a) =>
    `${cap(wx(a))} menyelimuti ${a.hasLocation ? a.location : "langit hari ini"} di ${a.tempC?.toFixed(0)}°C. Tenang dan stabil.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)} ${a.hasLocation ? `di ${a.location}` : ""}. Hari yang standar — tidak ada yang istimewa, tidak ada yang perlu dikhawatirkan.`,
  (a) =>
    `${a.hasLocation ? a.location : "Cuaca hari ini"} bisa dibilang pas-pasan. ${a.tempC?.toFixed(0)}°C, ${wx(a)} — cukup untuk aktivitas biasa.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C dan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : ""}. Nggak ada yang spesial, tapi nggak ada yang salah juga.`,
  (a) =>
    `Kondisi ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"} dengan suhu ${a.tempC?.toFixed(0)}°C. Standar, seperti biasanya.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C, ${wx(a)}, udara biasa — ${a.hasLocation ? a.location : "hari ini"} nggak punya cerita cuaca yang menarik, tapi itu bukan hal buruk.`,
  (a) =>
    `Cuaca ${a.hasLocation ? a.location : "hari ini"} ${wx(a)}, ${a.tempC?.toFixed(0)}°C. Stabil, tenang, dan bisa diprediksi. Kadang itulah yang kita butuhkan.`,
];

const TEMP_SANGAT_PANAS: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C berisiko heat stroke. Hindari keluar pukul 10 hingga 15.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C terasa menyengat. Hidrasi jadi prioritas utama hari ini.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C bisa memaksa tubuh bekerja keras. Lindungi kepala dan perbanyak minum.`,
  (a) =>
    `Di ${a.tempC?.toFixed(0)}°C ini tubuh kehilangan cairan lebih cepat. Jangan remehkan dehidrasi.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C — rasanya seperti sedang dipanggang. Kalau bisa, tunda dulu aktivitas outdoor sampai sore.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C bukan main-main. Tubuhmu butuh lebih banyak cairan dari biasanya. Jangan tunggu haus untuk minum.`,
  (a) =>
    `Panas ekstrem ${a.tempC?.toFixed(0)}°C bisa bikin lemas dalam hitungan menit. Pastikan ada tempat teduh di dekatmu.`,
  (a) =>
    `Udara terasa membakar di ${a.tempC?.toFixed(0)}°C. AC dan kipas angin bukan lagi kemewahan, tapi kebutuhan.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — suhu ini tidak bersahabat sama kulit. Tabir surya wajib, topi juga.`,
  (a) =>
    `Bayangkan ${a.tempC?.toFixed(0)}°C tanpa angin sepoi — ya, hari ini seperti itu. Lindungi diri dari sengatan langsung.`,
];

const TEMP_PANAS: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C cukup terik. Jaga asupan air agar tetap bugar.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C terasa hangat menyengat. Hindari aktivitas berat saat puncak terik.`,
  (a) =>
    `Di ${a.tempC?.toFixed(0)}°C ini keringat lebih deras dari biasanya. Pastikan hidrasi terjaga.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C terasa seperti ada di dekat oven. Masih bisa ditoleransi, tapi jangan paksakan diri saat siang.`,
  (a) =>
    `Cuaca hangat ${a.tempC?.toFixed(0)}°C — udaranya terasa berat, tapi belum sampai tahap membahayakan. Bawa air kemana pun kamu pergi.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C artinya kipas angin akan jadi teman terbaikmu hari ini. Jangan lupa minum.`,
  (a) =>
    `Panas ${a.tempC?.toFixed(0)}°C — masih masuk akal, tapi tubuh tetap perlu dijaga. Istirahat di tempat teduh kalau mulai pusing.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C, langit cerah, sinar matahari terasa langsung ke kulit. SPF minimal 30, ya.`,
];

const TEMP_SANGAT_DINGIN: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `${a.tempC?.toFixed(0)}°C terasa menggigit. Pakaian berlapis hari ini bukan pilihan, melainkan keharusan.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C, pastikan seluruh tubuh terlindungi sebelum keluar.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C di luar bisa terasa jauh lebih dingin dengan angin. Berpakaian hangat.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — dinginnya menusuk sampai ke tulang. Kalau bisa, stay di rumah dengan minuman hangat.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C, angin menambah efek dingin yang signifikan. Lapisan jaket tebal wajib hari ini.`,
  (a) =>
    `Hari ini ${a.tempC?.toFixed(0)}°C — bukan suhu yang biasa buat Indonesia. Siapkan selimut dan jaket ekstra.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C dan udara dingin menusuk. Tubuh butuh energi ekstra untuk tetap hangat, jangan lupa sarapan.`,
  (a) =>
    `Dingin ${a.tempC?.toFixed(0)}°C membuat tangan dan kaki cepat mati rasa. Sarung tangan bukan lagi aksesori, tapi perlindungan.`,
];

const TEMP_DINGIN: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C terasa cukup dingin. Jaket atau sweater tipis bakal membantu.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — udaranya dingin tapi masih nyaman dengan jaket. Cocok buat aktivitas pagi.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C bikin udara pagi terasa segar. Nikmati dengan secangkir kopi hangat.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — dingin yang menyejukkan, bukan yang membekukan. Pas buat olahraga ringan.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C, udara segar dan dingin. Saat yang tepat untuk jalan pagi.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — cukup dingin untuk membuatmu ingin memakai selimut, tapi tidak sampai menggigil.`,
];

const TEMP_HANGAT: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C terasa nyaman dan bersahabat. Cocok untuk aktivitas ringan di luar.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — hangatnya pas, nggak bikin gerah. Hari yang menyenangkan untuk beraktivitas.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C bikin udara terasa bersahabat. Tidak perlu jaket, cukup nyaman.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C, hangat yang menenangkan. Buka jendela dan biarkan udara segar masuk.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C — masih nyaman untuk jalan-jalan, asal jangan lupa minum.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — suhu hangat yang ideal. Nggak perlu khawatir kedinginan atau kepanasan.`,
];

const TEMP_SEJUK: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `${a.tempC?.toFixed(0)}°C terasa pas — nggak terlalu panas, nggak terlalu dingin. Enak buat jalan santai.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C bikin udara terasa ringan. Jaket tipis mungkin cukup kalau keluar malam.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C, suhu yang pas buat ngopi sambil duduk-duduk di teras.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C — sejuk dan nyaman. Kalau ada kesempatan, nikmati udara segar hari ini.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — tipe suhu yang bikin kamu males berdiam diri di rumah. Ajak temen jalan-jalan!`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C mengingatkan pada pagi hari di pegunungan. Segar dan menenangkan.`,
  (a) =>
    `${a.tempC?.toFixed(0)}°C — udara sejuk, langit bersahabat, dan hatipun ikut tenang. Hari yang menyenangkan.`,
  (a) =>
    `Suhu ${a.tempC?.toFixed(0)}°C — bukan hanya nyaman, tapi juga bikin produktivitas meningkat. Manfaatkan!`,
];

const HUMIDITY_SANGAT_LEMBAP: Array<(a: TemplateArgs) => string> = [
  (a) => `Kelembapan ${a.humidity}% membuat udara terasa berat dan gerah.`,
  (a) =>
    `${a.humidity}% kelembapan cukup ekstrem. Risiko dehidrasi tersembunyi meski tidak terasa haus.`,
  (a) =>
    `Udara lembap hingga ${a.humidity}%. Kurangi aktivitas fisik intens hari ini.`,
  (a) =>
    `Bahkan tanpa bergerak, keringat tetap keluar di kelembapan ${a.humidity}%. Tubuh bekerja ekstra untuk mendinginkan diri.`,
  (a) =>
    `Kelembapan ${a.humidity}% — rasanya seperti berenang di udara. Jaket tipis pun terasa terlalu berat.`,
  (a) =>
    `${a.humidity}% kelembapan bikin udara terasa lengket dan sesak. Minum lebih banyak dari biasanya.`,
  (a) =>
    `Udara lembap ${a.humidity}% membuat tidur siang terasa pengap. Pastikan sirkulasi udara di ruangan cukup baik.`,
];

const HUMIDITY_KERING: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Udara kering di ${a.humidity}%. Tenggorokan dan kulit bisa terasa tidak nyaman, perbanyak minum.`,
  (a) =>
    `${a.humidity}% kelembapan terhitung rendah. Pertimbangkan pelembap dan perbanyak asupan cairan.`,
  (a) =>
    `Udara kering ${a.humidity}% — kulit dan bibir cepat terasa kering. Bawalah pelembap bibir kemana pun.`,
  (a) =>
    `Kelembapan hanya ${a.humidity}%. Mata dan tenggorokan mungkin terasa gatal. Tetes mata bisa membantu.`,
  (a) =>
    `Kering hingga ${a.humidity}%. Debu lebih mudah beterbangan, masker mungkin perlu kalau kamu sensitif.`,
];

const WIND_BADAI: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s cukup kuat untuk merubuhkan dahan. Jauhi area terbuka.`,
  (a) =>
    `${a.windSpeed?.toFixed(0)} m/s bukan angin sepoi. Tetap di dalam dan jauh dari jendela.`,
  (a) =>
    `Badai angin ${a.windSpeed?.toFixed(0)} m/s sedang melanda. Amankan benda ringan di luar.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s — pohon dan baliho bisa tumbang kapan saja. Jangan berteduh di bawah papan reklame.`,
  (a) =>
    `Hari ini angin bertiup sangat kencang, ${a.windSpeed?.toFixed(0)} m/s. Kalau sedang di jalan, hindari area pepohonan rimbun.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s — helm dan jaket terasa seperti layar perahu. Berkendara butuh keseimbangan ekstra.`,
  (a) =>
    `Angin kencang ${a.windSpeed?.toFixed(0)} m/s membawa risiko serius. Benda ringan di balkon atau halaman sebaiknya diamankan.`,
];

const WIND_KENCANG: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Angin kencang ${a.windSpeed?.toFixed(0)} m/s. Waspada pohon tumbang dan papan reklame.`,
  (a) =>
    `${a.windSpeed?.toFixed(0)} m/s terasa berat untuk berkendara motor. Hati-hati di jalan.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s hari ini. Pegang erat barang bawaan di luar.`,
  (a) =>
    `Angin berhembus cukup kencang, ${a.windSpeed?.toFixed(0)} m/s. Topi dan payung mungkin nggak akan bertahan lama.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s — rambut bakal berantakan dan debu beterbangan. Siap-siap kalau keluar.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s bikin jalan kaki terasa lebih berat. Tapi masih aman selama nggak ada pohon rapuh di sekitar.`,
  (a) =>
    `Angin hari ini cukup terasa, ${a.windSpeed?.toFixed(0)} m/s. Perhatikan barang ringan di sekitar rumah.`,
];

const WIND_SEDANG: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s cukup terasa. Barang ringan seperti kertas atau plastik perlu diamankan.`,
  (a) =>
    `${a.windSpeed?.toFixed(0)} m/s — angin lumayan, tapi masih nyaman untuk keluar. Jaga topi tetap di kepala.`,
  (a) =>
    `Angin berhembus dengan kecepatan ${a.windSpeed?.toFixed(0)} m/s. Masih aman untuk aktivitas biasa.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s bikin suara dedaunan berdesir. Tenang dan menenangkan.`,
  (a) =>
    `${a.windSpeed?.toFixed(0)} m/s — angin cukup terasa kalau berkendara motor, tapi masih dalam batas wajar.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s menambah kesejukan udara. Cocok untuk jalan sore.`,
];

const WIND_RINGAN: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Angin sepoi-sepoi ${a.windSpeed?.toFixed(0)} m/s menemani langkahmu. Udara terasa segar.`,
  (a) =>
    `${a.windSpeed?.toFixed(0)} m/s — angin ringan yang bikin suasana tambah nyaman.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s bertiup lembut. Hari yang sempurna untuk piknik.`,
  (a) =>
    `Angin ringan ${a.windSpeed?.toFixed(0)} m/s membuat udara terasa hidup. Sangat bersahabat.`,
  (a) =>
    `Angin ${a.windSpeed?.toFixed(0)} m/s — tidak terlalu kencang, tidak terlalu lemah. Pas-pas.`,
  (a) =>
    `Hembusan angin ${a.windSpeed?.toFixed(0)} m/s bikin rambut terasa tertiup lembut. Hari yang indah.`,
];

const RAIN_TINGGI: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Hujan hampir pasti turun, peluang ${a.pop}%${a.precipMm && a.precipMm > 0 ? ` dengan estimasi ${a.precipMm} mm` : ""}. Bawa jas hujan.`,
  (a) =>
    `Peluang hujan ${a.pop}%${a.precipMm && a.precipMm > 0 ? `, potensi curah ${a.precipMm} mm` : ""}. Hampir tidak bisa dihindari hari ini.`,
  (a) => `${a.pop}% kemungkinan hujan turun. Jangan keluar tanpa perlindungan.`,
  (a) =>
    `Awan hujan sudah mengumpul, peluang ${a.pop}%${a.precipMm && a.precipMm > 0 ? ` sebanyak ${a.precipMm} mm` : ""}. Siapkan jas hujan.`,
  (a) =>
    `Langit sudah gelap, peluang hujan ${a.pop}%. Sepertinya hujan bukan lagi kemungkinan — tinggal menunggu waktu.`,
  (a) =>
    `${a.pop}% — hampir pasti basah kalau keluar tanpa pelindung. Jas hujan atau payung besar, pilih sendiri.`,
  (a) =>
    `Peluang hujan ${a.pop}%${a.precipMm && a.precipMm > 0 ? `, intensitas ${a.precipMm} mm` : ""}. Kalau memungkinkan, tunda dulu perjalanan yang nggak urgent.`,
  (a) =>
    `Hujan ${a.pop}% siap turun kapan saja. Hari seperti ini enaknya bikin kopi dan duduk di teras.`,
];

const RAIN_LEBAT: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Curah hujan ${a.precipMm} mm masuk kategori lebat. Waspadai genangan dan banjir lokal.`,
  (a) =>
    `${a.precipMm} mm bukan sekadar gerimis. Banjir lokal menjadi risiko nyata di titik rendah.`,
  (a) =>
    `Air sebanyak ${a.precipMm} mm bakal turun — jalanan bisa berubah jadi sungai dalam hitungan jam. Hindari area rendah.`,
  (a) =>
    `Hujan lebat ${a.precipMm} mm membuat visibilitas menurun drastis. Kalau sedang di jalan, cari tempat aman untuk berteduh.`,
  (a) =>
    `${a.precipMm} mm — ini bukan hujan biasa. Genangan di jalan bisa mencapai lutuh. Siapkan sepatu bot.`,
];

const RAIN_SEDANG: Array<(a: TemplateArgs) => string> = [
  (a) => `Peluang hujan ${a.pop}%. Bawa payung sebagai antisipasi.`,
  (a) =>
    `Ada kemungkinan ${a.pop}% hujan hari ini. Payung kecil di tas tidak ada salahnya.`,
  (a) =>
    `${a.pop}% kemungkinan gerimis. Antisipasi dengan payung jika bepergian jauh.`,
  (a) =>
    `Langit agak mendung, peluang hujan ${a.pop}%. Mungkin cuma gerimis, tapi mending siap-siap.`,
  (a) =>
    `${a.pop}% — hujan masih 50:50. Payung lipat di tas jadi penyelamat dadakan.`,
  (a) =>
    `Kemungkinan hujan ${a.pop}%. Nggak perlu khawatir berlebihan, tapi kalau bepergian jauh, payung adalah teman setia.`,
];

const UV_EKSTREM: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `UV index ${a.uvi} masuk level ekstrem. Hindari paparan langsung pukul 10 hingga 16 dan pakai SPF 50+.`,
  (a) =>
    `UV ${a.uvi} bisa merusak kulit dalam hitungan menit tanpa perlindungan. Jangan remehkan.`,
  (a) =>
    `UV ${a.uvi} ekstrem hari ini. Tabir surya, kacamata, dan penutup kepala wajib jika harus keluar.`,
  (a) =>
    `UV ${a.uvi} — tingkat yang sama seriusnya dengan berada di atas gunung tanpa pelindung. Kulit bisa terbakar dalam 10 menit.`,
  (a) =>
    `Paparan UV ${a.uvi} termasuk yang paling berbahaya. Bayangkan kulitmu terkena sinar langsung selama 15 menit — efeknya terasa sampai malam.`,
  (a) =>
    `UV ${a.uvi}: tabir surya SPF 50+ bukan saran, tapi kewajiban. Ditambah topi lebar kalau bisa.`,
  (a) =>
    `Sinar UV hari ini mencapai ${a.uvi} — level yang bisa meninggalkan bekas terbakar. Lindungi area leher dan telinga yang sering terlewat.`,
];

const UV_SANGAT_TINGGI: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `UV index ${a.uvi} sangat tinggi. Aplikasikan ulang tabir surya SPF 50+ setiap dua jam.`,
  (a) =>
    `Paparan UV ${a.uvi} bisa membakar kulit lebih cepat dari yang kamu kira. Pakai perlindungan lengkap.`,
  (a) =>
    `UV ${a.uvi} cukup serius. Hindari keluar tanpa tabir surya, terutama saat siang.`,
  (a) =>
    `UV ${a.uvi} — kulit bisa merah meski cuma 20 menit di bawah sinar langsung. SPF minimal 30, topi, dan kacamata.`,
  (a) =>
    `UV hari ini ${a.uvi}. Kalau kamu punya riwayat kulit sensitif, sebaiknya hindari sinar langsung antara jam 11-15.`,
  (a) =>
    `UV ${a.uvi} — bukan level untuk jalan-jalan santai tanpa perlindungan. Aplikasikan ulang tabir surya secara berkala.`,
];

const VIS_BURUK: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Jarak pandang hanya ${a.visKm} km. Nyalakan lampu kendaraan dan kurangi kecepatan.`,
  (a) =>
    `Visibilitas terbatas ${a.visKm} km. Berkendara butuh ekstra kewaspadaan hari ini.`,
  (a) =>
    `Kabut memangkas jarak pandang hingga ${a.visKm} km. Jaga jarak aman antar kendaraan.`,
  (a) =>
    `Jarak pandang cuma ${a.visKm} km — seperti berkendara dalam nektar. Lampu kabut wajib dinyalakan.`,
  (a) =>
    `Visibilitas ${a.visKm} km, kabut cukup tebal. Kalau bisa tunda perjalanan sampai kabut sedikit menyusut.`,
  (a) =>
    `Hanya ${a.visKm} km jarak pandang — jalanan tidak seaman biasanya. Kurangi kecepatan dan jaga jarak.`,
  (a) =>
    `Visibilitas ${a.visKm} km, disarankan menggunakan jalur alternatif yang lebih terang dan bebas kabut.`,
];

const HUMIDITY_NORMAL: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Kelembapan ${a.humidity}% terasa pas — tidak kering, tidak lengket. Nyaman untuk bernapas.`,
  (a) =>
    `${a.humidity}% — kelembapan ideal. Udara terasa segar dan seimbang.`,
  (a) =>
    `Udara dengan kelembapan ${a.humidity}%. Kondisi yang nyaman untuk kulit dan pernapasan.`,
  (a) =>
    `Kelembapan ${a.humidity}% menambah kenyamanan hari ini. Tidak ada keluhan dari cuaca.`,
  (a) =>
    `${a.humidity}% kelembapan — seperti yang diharapkan dari hari yang sempurna.`,
];

const SKY_CERAH: Array<(a: TemplateArgs) => string> = [
  (a) =>
    `Langit cerah bersinar tanpa halangan. Matahari menemani setiap langkahmu hari ini.`,
  (a) =>
    `Cerah dan bersahabat — sinar matahari memberikan energi positif untuk memulai hari.`,
  (a) =>
    `Langit biru bersih tanpa awan gelap. Hari ini adalah undangan untuk keluar rumah.`,
  (a) =>
    `Sinar matahari cukup terang, tapi masih nyaman. Jangan lupa SPF tipis untuk perlindungan.`,
  (a) =>
    `Cuaca cerah total — langit biru dari pagi sampai sore. Hari yang sempurna untuk menjemur atau bersepeda.`,
  (a) =>
    `Langit bersih dari ufuk ke ufuk. Matahari bersinar dengan ramah. Saatnya beraktivitas!`,
  (a) =>
    `Tidak ada setitik awan pun di langit. Pemandangan yang menyegarkan mata dan jiwa.`,
  (a) =>
    `Cerah penuh hari ini. Cocok untuk piknik, jalan-jalan, atau sekadar duduk santai di taman.`,
];

// ─── Sentence generator ──────────────────────────────────────────────────────

function generateNlgSentences(
  analysis: AnalysisResult,
  stemmed: StemmedWeather,
  tokens: WeatherToken[],
  dateISO?: string,
): NlgSentence[] {
  const sentences: NlgSentence[] = [];
  const concepts = analysis.priorityConcepts;
  const sentiment = analysis.adjustedSentiment;
  const insights = analysis.reasoning.derivedInsights;

  const getNum = (key: string): number | undefined => {
    const t = tokens.find((tk) => tk.key === key);
    return t ? Number(t.rawValue) : undefined;
  };
  const getStr = (key: string): string | undefined => {
    const t = tokens.find((tk) => tk.key === key);
    return t ? String(t.rawValue) : undefined;
  };

  const seedTokens = dateISO
    ? [
        ...tokens,
        {
          key: "_date",
          rawValue: dateISO,
          unit: "",
          textToken: dateISO,
          category: "location" as const,
        },
      ]
    : tokens;
  const seed = seedFromTokens(stemmed.location, seedTokens);

  const locationHuman = humanLocation(stemmed.location);
  const wxSlug = getStr("weather_primary") ?? "";
  const wxLabelResolved = wxLabelId(wxSlug);

  const args: TemplateArgs = {
    location: locationHuman || "Cuaca hari ini",
    hasLocation: locationHuman.length > 0,
    tempC: getNum("temp_c"),
    humidity: getNum("humidity_pct"),
    windSpeed:
      getNum("wind_speed_kph") !== undefined
        ? getNum("wind_speed_kph")! / 3.6
        : undefined,
    windDir: getStr("wind_dir"),
    windGust:
      getNum("wind_gust_kph") !== undefined
        ? getNum("wind_gust_kph")! / 3.6
        : undefined,
    uvi: getNum("uvi"),
    visKm: getNum("visibility_km"),
    pop: getNum("pop_pct"),
    precipMm: getNum("precip_mm"),
    wxLabel: wxLabelResolved,
    seed,
  };

  const hasConcept = (c: string) => concepts.some((k) => k.concept === c);
  const conceptWeight = (c: string): number =>
    concepts.find((k) => k.concept === c)?.weight ?? 0;

  // ── Opening ──────────────────────────────────────────────────────────────
  const openingBanks: Record<string, Array<(a: TemplateArgs) => string>> = {
    baik: OPENING_BAIK,
    waspada: OPENING_WASPADA,
    berbahaya: OPENING_BERBAHAYA,
    cukup: OPENING_CUKUP,
  };
  const openingBank = openingBanks[sentiment] ?? OPENING_CUKUP;
  sentences.push({
    type: "opening",
    text: pick(openingBank, seed, 0)(args),
    weight: 1.0,
  });

  // ── Insert derived insights from reasoning engine ────────────────────────
  const dangerousInsights = insights.filter((i) => i.severity >= 0.35);
  for (const insight of dangerousInsights) {
    sentences.push({
      type: "condition",
      text: insight.label + ". " + insight.advice,
      weight: 0.85 + insight.severity * 0.2,
    });
  }

  // ── Suhu ─────────────────────────────────────────────────────────────────
  if (hasConcept("sangat_panas")) {
    sentences.push({
      type: "condition",
      text: pick(TEMP_SANGAT_PANAS, seed, 1)(args),
      weight: 0.95,
    });
  } else if (hasConcept("sangat_dingin")) {
    sentences.push({
      type: "condition",
      text: pick(TEMP_SANGAT_DINGIN, seed, 1)(args),
      weight: 0.9,
    });
  } else if (hasConcept("panas")) {
    sentences.push({
      type: "condition",
      text: pick(TEMP_PANAS, seed, 1)(args),
      weight: 0.8,
    });
  } else if (hasConcept("dingin")) {
    sentences.push({
      type: "condition",
      text: pick(TEMP_DINGIN, seed, 1)(args),
      weight: 0.75,
    });
  } else if (hasConcept("hangat")) {
    sentences.push({
      type: "condition",
      text: pick(TEMP_HANGAT, seed, 1)(args),
      weight: 0.7,
    });
  } else if (hasConcept("sejuk")) {
    sentences.push({
      type: "condition",
      text: pick(TEMP_SEJUK, seed, 1)(args),
      weight: 0.7,
    });
  }

  // ── Kelembapan ──────────────────────────────────────────────────────────
  if (hasConcept("sangat_lembap")) {
    sentences.push({
      type: "condition",
      text: pick(HUMIDITY_SANGAT_LEMBAP, seed, 2)(args),
      weight: 0.75,
    });
  } else if (hasConcept("sangat_kering")) {
    sentences.push({
      type: "condition",
      text: pick(HUMIDITY_KERING, seed, 2)(args),
      weight: 0.72,
    });
  }

  // ── Angin ────────────────────────────────────────────────────────────────
  if (hasConcept("badai")) {
    sentences.push({
      type: "wind",
      text: pick(WIND_BADAI, seed, 3)(args),
      weight: 1.0 - conceptWeight("badai") + 0.1,
    });
  } else if (hasConcept("angin_kencang")) {
    sentences.push({
      type: "wind",
      text: pick(WIND_KENCANG, seed, 3)(args),
      weight: 0.85,
    });
  } else if (hasConcept("angin_sedang")) {
    sentences.push({
      type: "wind",
      text: pick(WIND_SEDANG, seed, 3)(args),
      weight: 0.7,
    });
  } else if (hasConcept("angin_ringan") || hasConcept("sepoi_sepoi") || hasConcept("tenang")) {
    sentences.push({
      type: "wind",
      text: pick(WIND_RINGAN, seed, 3)(args),
      weight: 0.5,
    });
  }

  // ── Hujan ────────────────────────────────────────────────────────────────
  const rainConcept = concepts.find((c) =>
    ["hampir_pasti_hujan", "kemungkinan_hujan"].includes(c.concept),
  );
  if (rainConcept) {
    const pop = args.pop ?? 0;
    if (pop > 80 || rainConcept.concept === "hampir_pasti_hujan") {
      sentences.push({
        type: "rain",
        text: pick(RAIN_TINGGI, seed, 4)(args),
        weight: 0.9,
      });
    } else {
      sentences.push({
        type: "rain",
        text: pick(RAIN_SEDANG, seed, 4)(args),
        weight: 0.7,
      });
    }
  }

  if (
    args.precipMm &&
    args.precipMm >= 10 &&
    hasConcept("hampir_pasti_hujan")
  ) {
    sentences.push({
      type: "rain",
      text: pick(RAIN_LEBAT, seed, 5)(args),
      weight: 0.88,
    });
  }

  // ── UV tinggi ────────────────────────────────────────────────────────────
  if (hasConcept("uv_ekstrem")) {
    sentences.push({
      type: "uv",
      text: pick(UV_EKSTREM, seed, 6)(args),
      weight: 0.95,
    });
  } else if (hasConcept("uv_sangat_tinggi")) {
    sentences.push({
      type: "uv",
      text: pick(UV_SANGAT_TINGGI, seed, 6)(args),
      weight: 0.8,
    });
  }

  // ── Visibilitas buruk ────────────────────────────────────────────────────
  if (hasConcept("jarak_pandang_buruk")) {
    sentences.push({
      type: "condition",
      text: pick(VIS_BURUK, seed, 7)(args),
      weight: 0.85,
    });
  }

  // ── Sky cerah (hanya kalau sentimen baik) ────────────────────────────────
  if (sentiment === "baik" && (hasConcept("kondisi_sunny") || hasConcept("kondisi_clear"))) {
    sentences.push({
      type: "condition",
      text: pick(SKY_CERAH, seed, 8)(args),
      weight: 0.55,
    });
  }

  // ── Kelembapan normal (hanya kalau sentimen baik/cukup) ─────────────────
  if ((sentiment === "baik" || sentiment === "cukup") && hasConcept("normal")) {
    sentences.push({
      type: "condition",
      text: pick(HUMIDITY_NORMAL, seed, 9)(args),
      weight: 0.45,
    });
  }

  // ── Sort: opening tetap pertama, sisanya by weight DESC ──────────────────
  const opening = sentences.filter((s) => s.type === "opening");
  const middle = sentences
    .filter((s) => s.type !== "opening")
    .sort((a, b) => b.weight - a.weight);

  return [...opening, ...middle];
}

// ─── Narrative builder — max 3 kalimat ─────────────────────────────────────

const MAX_BODY_SENTENCES = 3;

function buildNarrative(sentences: NlgSentence[]): string {
  const opening = sentences.find((s) => s.type === "opening");
  const body = sentences
    .filter((s) => s.type !== "opening" && s.type !== "closing")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_BODY_SENTENCES);

  const all = opening ? [opening, ...body] : body;
  if (all.length === 0) return "";
  return all
    .map((s) => s.text)
    .join(" ")
    .trim();
}

function buildKeyPhrase(
  topTerms: TfIdfTerm[],
  concepts: StemmedConcept[],
  insights: DerivedInsight[],
): string {
  // Prioritaskan insights dari reasoning engine untuk keyPhrase
  if (insights.length > 0) {
    const topInsights = insights
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 2);
    const labels = topInsights.map((i) => i.label);
    return labels.join(" · ");
  }

  // Fallback: pakai TF-IDF
  const top3 = topTerms.slice(0, 3);
  const labels = top3
    .map((t) => {
      const match = concepts.find((c) => c.concept === t.term || c.concept === `kondisi_${t.term}`);
      return match?.humanLabel ?? t.term;
    })
    .filter(Boolean);

  if (labels.length === 0) return "Kondisi cuaca normal";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} · ${labels[1]}`;
  return `${labels[0]} · ${labels[1]} · ${labels[2]}`;
}

// ─── MAIN NLG ────────────────────────────────────────────────────────────────

/**
 * Terima AnalysisResult dari analyzeWeather() dan WeatherToken[] asli,
 * hasilkan narasi bahasa Indonesia yang natural.
 *
 * Menggunakan adjustedSentiment & priorityConcepts dari analysis
 * (yang sudah diproses oleh reasoning engine) untuk narasi yang lebih
 * kontekstual dibandingkan original stemmed.
 */
export function generateNlg(
  analysis: AnalysisResult,
  stemmed: StemmedWeather,
  tokens: WeatherToken[],
  dateISO?: string,
): NlgResult {
  const sentences = generateNlgSentences(analysis, stemmed, tokens, dateISO);
  const narrative = buildNarrative(sentences);
  const keyPhrase = buildKeyPhrase(
    analysis.features.topTerms,
    stemmed.concepts,
    analysis.reasoning.derivedInsights,
  );

  return { sentences, narrative, keyPhrase };
}