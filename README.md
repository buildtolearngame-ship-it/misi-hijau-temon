# Misi Hijau Temon

Game edukasi memilah sampah untuk anak SD di Kapanewon Temon, Kulon Progo.
Bagian dari inisiatif **Temon Lestari**.

Versi: `0.2.0-tahap2` — data dan penilaian sudah di server.

---

## Status jujur

| Bagian | Keadaan |
|---|---|
| Logika database (skema, RLS, penilaian XP) | **Teruji** langsung di database |
| Antarmuka (6 layar) | **Teruji** di Tahap 1 |
| Alur browser → server | **BELUM PERNAH BERJALAN** |
| Papan peringkat | Belum dibuat (Tahap 3) |
| Dasbor guru | Belum dibuat (Tahap 4) |
| Tayang di internet | Belum |

Alur browser → server belum pernah jalan karena **anonymous sign-in masih dimatikan**
di proyek Supabase. Itu satu toggle di dashboard, lihat bagian *Yang harus dilakukan*.

---

## Yang harus dilakukan sebelum bisa dipakai

Supabase Dashboard → Authentication → Sign In / Providers → **Anonymous sign-ins → ON**

Tanpa ini, halaman akan menampilkan *"Pemain anonim belum diaktifkan di server."*

---

## Menjalankan di komputer sendiri

```bash
cd misi-hijau-temon
python -m http.server 8765
# buka http://127.0.0.1:8765
```

Tidak ada proses build. Tidak ada `npm install`. Tidak ada dependensi luar —
termasuk tidak memakai `supabase-js`, klien HTTP-nya ditulis sendiri di `js/api.js`.

---

## Berkas

| Berkas | Isi |
|---|---|
| `index.html` | 6 layar: mulai, kenalan, beranda, main, hasil, profil |
| `css/style.css` | seluruh gaya, mobile-first, tanpa font luar |
| `js/config.js` | URL server, daftar tempat sampah, liga, avatar |
| `js/api.js` | klien Supabase: masuk anonim, perbarui token, panggil fungsi |
| `js/store.js` | satu-satunya modul yang menyentuh data |
| `js/app.js` | alur layar dan jalannya satu ronde |
| `js/content.js` | **arsip** — 34 soal, kini hidup di tabel `game_items`, tidak dimuat browser |
| `supabase/migrations/0001_init.sql` | skema, RLS, fungsi awal |
| `supabase/migrations/0002_round_answers.sql` | jawaban per soal, `submit_answer` + `finish_round` |

---

## Kenapa kunci jawaban tidak ada di browser

Kalau kunci jawaban ikut dikirim ke browser, siapa pun bisa membuka DevTools dan
mendapat poin penuh tanpa bermain. Papan peringkat jadi tidak berarti.

Karena itu:

1. Browser meminta ronde → server memilih 10 soal dan mengirim **tanpa** kolom jawaban.
2. Anak mengetuk tempat sampah → browser mengirim **satu** jawaban.
3. Server mencatatnya, lalu membalas benar/salah **hanya untuk soal itu**.
4. Semua soal terjawab → browser meminta penilaian → server menghitung XP.

Anak tetap dapat umpan balik instan, tetapi kunci soal berikutnya tidak pernah bocor.

---

## Kenapa XP tidak bisa digandakan

- Angka XP tidak pernah dikirim dari browser. Browser hanya mengirim pilihan tempat sampah.
- `xp_events.round_id` punya constraint **UNIQUE**. Memanggil `finish_round` dua kali
  mengembalikan hasil yang sama dan **tidak** menambah baris XP.
- Batas 5 ronde/hari dan 300 XP/hari diperiksa di database, bukan di tampilan.

Terbukti saat uji: `finish_round` dipanggil dua kali → `already_scored: true`,
XP tetap 30, `xp_events` tetap 1 baris.

---

## Isi database

| Tabel | Guna |
|---|---|
| `profiles` | nama panggilan, avatar, liga, kode pemain |
| `rounds` | satu ronde: soal yang dipilih, waktu mulai, skor |
| `round_answers` | jawaban per soal, tidak bisa diubah setelah tercatat |
| `xp_events` | satu baris per ronde yang dinilai (penjaga XP ganda) |
| `game_items` | bank soal **beserta kunci** — tidak bisa dibaca klien |
| `avatars`, `nickname_words` | pilihan yang sah |
| `seasons` | musim mingguan untuk papan peringkat nanti |

Fungsi: `create_profile`, `start_round`, `submit_answer`, `finish_round`,
`get_my_stats`, `delete_my_data`.

`game_items`, `rounds`, `round_answers`, `xp_events` **tidak punya izin baca sama sekali**
untuk klien. Semua akses lewat fungsi `SECURITY DEFINER`.

---

## Batasan yang perlu diketahui

1. **Progres terikat ke satu browser.** Pemain masuk sebagai akun anonim; tokennya
   disimpan di `localStorage`. Menghapus data browser = progres hilang dan tidak bisa
   dibuka lagi. Kode pemain (`TMN-XXXX`) belum bisa dipakai untuk masuk di perangkat lain.
2. **Bank soal belum disetujui guru.** 34 soal perlu dibaca dan disepakati sebelum
   dipakai di kelas — ini risiko isi terbesar, bukan risiko teknis.
3. **Batas waktu 8 detik per ronde.** Penjaga sederhana terhadap skrip otomatis.
   Anak yang sangat cepat bisa kena; kalau itu terjadi, turunkan ambangnya di
   `finish_round`.
4. **Belum ada hosting.** Kalau nanti ditayangkan, jangan dibuka lewat `iframe` —
   penyimpanan sesi Supabase akan terpisah dan pemain akan kehilangan progresnya.
5. **`PERISAI-Medsos` masih dijeda** di Supabase untuk memberi tempat proyek ini
   pada paket gratis (batas 2 proyek aktif).
