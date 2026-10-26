/* ==========================================================================
   config.js — semua angka dan pilihan yang mungkin berubah
   ========================================================================== */

window.MHT = window.MHT || {};

MHT.config = {
  APP_NAME: 'Misi Hijau Temon',
  VERSION: '0.2.0-tahap2',

  /* ---- Server (arsitektur §6) ----
     Kunci ini memang publik: hanya untuk masuk sebagai pemain anonim.
     Semua aturan poin ditegakkan di database.                            */
  SUPABASE_URL: 'https://atwqhqopfqmwgxblmwsv.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0d3FocW9wZnFtd2d4Ymxtd3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NzIzMTUsImV4cCI6MjEwODU0ODMxNX0.esecgWSHcL04uk1ST7-T-VpXjwrBEXCh3X812cdHUGM',

  /* 'open' = tautan langsung bisa dimainkan (arsitektur §3.1) */
  ACCESS_MODE: 'open',

  /* ---- Aturan ronde ----
     Nilai di bawah hanya untuk MENAMPILKAN sisa kuota.
     Yang benar-benar menolak permainan adalah database.                */
  ROUND_SIZE: 10,
  MAX_ROUNDS_PER_DAY: 5,
  MAX_XP_PER_DAY: 300,

  /* ---- Tempat sampah ---- */
  BINS: [
    { id: 'organik',   label: 'Organik',   emoji: '🍃', hint: 'Sisa makhluk hidup',      color: '#16a34a' },
    { id: 'anorganik', label: 'Anorganik', emoji: '♻️', hint: 'Plastik, kaleng, kertas',  color: '#2563eb' },
    { id: 'b3',        label: 'B3',        emoji: '⚠️', hint: 'Berbahaya, minta bantuan', color: '#dc2626' }
  ],

  /* ---- Liga ---- */
  LEAGUES: [
    { id: 'tunas',      label: 'Liga Tunas',      grades: 'Kelas 1–2', emoji: '🌱' },
    { id: 'penjelajah', label: 'Liga Penjelajah', grades: 'Kelas 3–4', emoji: '🧭' },
    { id: 'pelindung',  label: 'Liga Pelindung',  grades: 'Kelas 5–6', emoji: '🛡️' }
  ],

  /* ---- Nama panggilan: dipilih dari daftar, tidak diketik bebas ----
     Daftar ini HARUS sama dengan tabel nickname_words di database;
     server menolak kata yang tidak ada di sana.                        */
  NICKNAME_WORDS: [
    'Tunas', 'Pandan', 'Cemara', 'Bakau', 'Kepiting', 'Walet',
    'Mangrove', 'Padi', 'Lebah', 'Penyu', 'Cangkang', 'Bambu',
    'Melati', 'Kamboja', 'Rumput', 'Kerang', 'Biawak', 'Gelatik',
    'Jambu', 'Sawo', 'Kelor', 'Beringin', 'Bintang', 'Embun'
  ],

  /* ---- Avatar: id dipakai database, emoji hanya untuk tampilan ---- */
  AVATARS: [
    { id: 'penyu',    emoji: '🐢' }, { id: 'kepiting', emoji: '🦀' },
    { id: 'ikan',     emoji: '🐟' }, { id: 'lebah',    emoji: '🐝' },
    { id: 'bunga',    emoji: '🌻' }, { id: 'lumba',    emoji: '🐬' },
    { id: 'kupu',     emoji: '🦋' }, { id: 'kelapa',   emoji: '🌴' },
    { id: 'burung',   emoji: '🐦' }, { id: 'kadal',    emoji: '🦎' },
    { id: 'daun',     emoji: '🍀' }, { id: 'kerang',   emoji: '🐚' }
  ]
};
