/* ==========================================================================
   content.js — bank soal Pilah Sampah
   --------------------------------------------------------------------------
   ATURAN ISI (penting, lihat dokumen arsitektur §14 risiko #1):
   - Hanya item yang TIDAK ambigu. Kalau satu item bisa diperdebatkan
     gurunya, jangan dimasukkan.
   - `reason` maksimal ±10 kata, karena dibaca anak kelas 1.
   - Semua item B3 wajib menyebut "minta bantuan orang dewasa" atau
     "tempat khusus", supaya anak tidak menangani limbah berbahaya.
   - Daftar ini WAJIB disepakati guru sebelum dipakai di kelas.
   ========================================================================== */

window.MHT = window.MHT || {};

MHT.content = {
  items: [

    /* ---------------- ORGANIK (12) ---------------- */
    { id: 'kulit-pisang',   name: 'Kulit pisang',   emoji: '🍌', bin: 'organik',
      reason: 'Sisa buah. Membusuk jadi pupuk.' },
    { id: 'nasi-sisa',      name: 'Nasi sisa',      emoji: '🍚', bin: 'organik',
      reason: 'Sisa makanan. Bisa jadi kompos.' },
    { id: 'sisa-sayur',     name: 'Sisa sayur',     emoji: '🥬', bin: 'organik',
      reason: 'Sisa tumbuhan. Jadi pupuk.' },
    { id: 'daun-kering',    name: 'Daun kering',    emoji: '🍂', bin: 'organik',
      reason: 'Bagian tumbuhan. Jadi kompos.' },
    { id: 'cangkang-telur', name: 'Cangkang telur', emoji: '🥚', bin: 'organik',
      reason: 'Sisa hewan. Hancur jadi pupuk.' },
    { id: 'kulit-semangka', name: 'Kulit semangka', emoji: '🍉', bin: 'organik',
      reason: 'Sisa buah. Jadi kompos.' },
    { id: 'bonggol-jagung', name: 'Bonggol jagung', emoji: '🌽', bin: 'organik',
      reason: 'Sisa tumbuhan. Jadi kompos.' },
    { id: 'tulang-ikan',    name: 'Tulang ikan',    emoji: '🐟', bin: 'organik',
      reason: 'Sisa hewan. Bisa jadi pupuk.' },
    { id: 'tempurung',      name: 'Tempurung kelapa', emoji: '🥥', bin: 'organik',
      reason: 'Bagian tumbuhan. Bisa jadi arang.' },
    { id: 'kulit-jeruk',    name: 'Kulit jeruk',    emoji: '🍊', bin: 'organik',
      reason: 'Sisa buah. Jadi kompos.' },
    { id: 'sekam-padi',     name: 'Sekam padi',     emoji: '🌾', bin: 'organik',
      reason: 'Sisa panen. Bisa jadi pupuk.' },
    { id: 'ranting',        name: 'Ranting kecil',  emoji: '🌿', bin: 'organik',
      reason: 'Bagian tumbuhan. Jadi kompos.' },

    /* ---------------- ANORGANIK (12) ---------------- */
    { id: 'botol-plastik',  name: 'Botol plastik',  emoji: '🥤', bin: 'anorganik',
      reason: 'Bisa didaur ulang jadi barang baru.' },
    { id: 'kaleng-minuman', name: 'Kaleng minuman', emoji: '🥫', bin: 'anorganik',
      reason: 'Logam. Bisa didaur ulang.' },
    { id: 'koran',          name: 'Koran bekas',    emoji: '📰', bin: 'anorganik',
      reason: 'Kertas. Bisa didaur ulang.' },
    { id: 'kardus',         name: 'Kardus',         emoji: '📦', bin: 'anorganik',
      reason: 'Kertas tebal. Bisa didaur ulang.' },
    { id: 'botol-kaca',     name: 'Botol kaca',     emoji: '🍾', bin: 'anorganik',
      reason: 'Kaca. Bisa dilebur jadi baru.' },
    { id: 'kantong-plastik', name: 'Kantong plastik', emoji: '🛍️', bin: 'anorganik',
      reason: 'Plastik. Bisa dipakai ulang.' },
    { id: 'gelas-plastik',  name: 'Gelas plastik',  emoji: '🥛', bin: 'anorganik',
      reason: 'Plastik. Bisa didaur ulang.' },
    { id: 'botol-sabun',    name: 'Botol sabun',    emoji: '🧴', bin: 'anorganik',
      reason: 'Plastik. Kosongkan lalu daur ulang.' },
    { id: 'kain-perca',     name: 'Kain perca',     emoji: '👕', bin: 'anorganik',
      reason: 'Kain. Bisa jadi lap atau kerajinan.' },
    { id: 'sendok-plastik', name: 'Sendok plastik', emoji: '🥄', bin: 'anorganik',
      reason: 'Plastik. Buang ke anorganik.' },
    { id: 'kertas-hvs',     name: 'Kertas bekas',   emoji: '📄', bin: 'anorganik',
      reason: 'Kertas. Bisa didaur ulang.' },
    { id: 'kaleng-biskuit', name: 'Kaleng biskuit', emoji: '🍪', bin: 'anorganik',
      reason: 'Logam. Bisa didaur ulang.' },

    /* ---------------- B3 (10) ---------------- */
    { id: 'baterai',        name: 'Baterai bekas',  emoji: '🔋', bin: 'b3',
      reason: 'Berbahaya. Kumpulkan di tempat khusus.' },
    { id: 'lampu',          name: 'Lampu bekas',    emoji: '💡', bin: 'b3',
      reason: 'Bahan berbahaya. Minta bantuan orang dewasa.' },
    { id: 'obat',           name: 'Obat kedaluwarsa', emoji: '💊', bin: 'b3',
      reason: 'Jangan dibuang sembarangan. Minta bantuan orang dewasa.' },
    { id: 'pestisida',      name: 'Botol pestisida', emoji: '🧪', bin: 'b3',
      reason: 'Racun. Jangan disentuh. Minta bantuan orang dewasa.' },
    { id: 'termometer',     name: 'Termometer bekas', emoji: '🌡️', bin: 'b3',
      reason: 'Bahan berbahaya. Serahkan ke tempat khusus.' },
    { id: 'kaleng-cat',     name: 'Kaleng cat sisa', emoji: '🎨', bin: 'b3',
      reason: 'Bahan kimia. Minta bantuan orang dewasa.' },
    { id: 'hp-rusak',       name: 'HP rusak',       emoji: '📱', bin: 'b3',
      reason: 'Sampah elektronik. Kumpulkan di tempat khusus.' },
    { id: 'kabel',          name: 'Kabel rusak',    emoji: '🔌', bin: 'b3',
      reason: 'Sampah elektronik. Kumpulkan di tempat khusus.' },
    { id: 'tinta-printer',  name: 'Tinta printer',  emoji: '🖨️', bin: 'b3',
      reason: 'Bahan kimia. Serahkan ke tempat khusus.' },
    { id: 'obat-nyamuk',    name: 'Kaleng obat nyamuk', emoji: '🦟', bin: 'b3',
      reason: 'Bahan kimia. Minta bantuan orang dewasa.' }
  ],

  /* Kalimat pengantar singkat di awal ronde (opsional, dipakai di Tahap 2) */
  intro: 'Ada 10 sampah. Masukkan ke tempat sampah yang benar, ya!'
};
