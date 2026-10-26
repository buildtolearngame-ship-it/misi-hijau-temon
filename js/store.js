/* ==========================================================================
   store.js — satu-satunya modul yang menyentuh penyimpanan
   --------------------------------------------------------------------------
   TAHAP 2: semua data ada di server (Supabase).

   Yang TIDAK dilakukan modul ini, dan itu disengaja:
     - tidak menghitung XP. Skor dan poin dihitung database.
     - tidak menyimpan kunci jawaban. Server hanya membalas benar/salah
       untuk soal yang baru saja dijawab.
     - tidak memercayai angka dari klien. Tidak ada satu pun parameter
       yang dikirim ke fungsi penilai selain id ronde dan pilihan tempat.
   ========================================================================== */

window.MHT = window.MHT || {};

MHT.store = (function () {
  const CFG = MHT.config;
  const API = MHT.api;

  let _profile = null;
  let _stats = null;

  /* ---------- pesan kesalahan yang bisa dibaca anak ---------- */

  const PESAN = {
    NETWORK: 'Tidak ada koneksi internet. Coba lagi, ya.',
    NO_SESSION: 'Server tidak mau menerima pemain baru. Coba muat ulang halaman.',
    anonymous_provider_disabled: 'Pemain anonim belum diaktifkan di server.',
    DAILY_ROUNDS_LIMIT: 'Kamu sudah main ' + CFG.MAX_ROUNDS_PER_DAY + ' kali hari ini. Ayo main lagi besok!',
    DAILY_XP_LIMIT: 'Bintangmu sudah penuh untuk hari ini. Ayo main lagi besok!',
    PROFILE_REQUIRED: 'Profil belum dibuat. Kembali dan isi dulu, ya.',
    ROUND_EXPIRED: 'Waktu ronde ini habis. Mulai ronde baru, ya.',
    ROUND_NOT_FOUND: 'Ronde ini tidak ditemukan. Mulai ronde baru, ya.',
    ROUND_CLOSED: 'Ronde ini sudah selesai.',
    NOT_COMPLETE: 'Masih ada soal yang belum dijawab.',
    TOO_FAST: 'Terlalu cepat. Coba pelan-pelan, ya.',
    AUTH_REQUIRED: 'Sesi habis. Muat ulang halaman.',
    BAD_NICKNAME: 'Nama panggilan tidak dikenali. Coba ganti.',
    BAD_NICKNAME_WORD: 'Nama panggilan tidak dikenali. Coba ganti.',
    BAD_AVATAR: 'Gambar itu tidak tersedia. Pilih yang lain.',
    BAD_LEAGUE: 'Liga tidak dikenali.',
    BAD_ITEM: 'Soal ini bukan bagian dari ronde.',
    BAD_BIN: 'Tempat sampah tidak dikenali.'
  };

  function friendly(err) {
    if (!err) return 'Ada yang salah. Coba lagi, ya.';
    const code = err.code || err.message;
    if (PESAN[code]) return PESAN[code];
    if (err.status === 0 || err.code === 'NETWORK') return PESAN.NETWORK;
    /* Selama masa uji, tampilkan kode aslinya supaya mudah dilaporkan. */
    return 'Ada yang salah (' + (code || 'unknown') + '). Coba lagi, ya.';
  }

  /* ---------- awal ---------- */

  async function init() {
    await API.ensureSession();

    const rows = await API.select(
      'profiles',
      'select=nickname,avatar_id,league,public_code,hidden&limit=1'
    );

    _profile = (rows && rows[0]) || null;
    _stats = _profile ? await API.rpc('get_my_stats') : null;

    return { profile: _profile, stats: _stats };
  }

  function hasProfile() {
    return !!(_profile && _profile.nickname);
  }

  function profile() {
    return _profile;
  }

  /* ---------- profil ---------- */

  async function simpanProfil(p) {
    const r = await API.rpc('create_profile', {
      p_nickname: p.nickname,
      p_avatar_id: p.avatarId,
      p_league: p.league
    });

    _profile = {
      nickname: r.nickname,
      avatar_id: r.avatar_id,
      league: r.league,
      public_code: r.public_code,
      hidden: r.hidden
    };

    await refreshStats();
    return _profile;
  }

  async function createProfile(p) {
    try {
      return await simpanProfil(p);
    } catch (e) {
      /* 23503 = foreign key: sesi menunjuk pengguna yang sudah tidak ada
         (mis. dihapus petugas lewat SQL). Ambil sesi baru, lalu ulangi sekali. */
      if (e.code === '23503') {
        API.clearSession();
        await API.ensureSession();
        return await simpanProfil(p);
      }
      throw e;
    }
  }

  /* ---------- ronde ---------- */

  async function startRound() {
    const r = await API.rpc('start_round');

    /* Soal yang sudah dijawab (kalau ronde dilanjutkan) dilewati. */
    const done = {};
    (r.answered || []).forEach(function (a) { done[a.item_id] = a; });

    const items = (r.items || []).map(function (it) {
      return { id: it.id, name: it.name, emoji: it.emoji };
    });

    return {
      roundId: r.round_id,
      resumed: !!r.resumed,
      items: items,
      answered: done,
      nextIndex: items.findIndex(function (it) { return !done[it.id]; })
    };
  }

  async function submitAnswer(roundId, itemId, bin) {
    const r = await API.rpc('submit_answer', {
      p_round_id: roundId,
      p_item_id: itemId,
      p_bin: bin
    });

    return {
      correct: r.correct,
      correctBin: r.correct_bin,
      reason: r.reason,
      answered: r.answered,
      total: r.total
    };
  }

  async function finishRound(roundId) {
    const r = await API.rpc('finish_round', { p_round_id: roundId });

    await refreshStats();

    return {
      score: r.score,
      total: r.total,
      xp: r.xp,
      xpRaw: r.xp_raw,
      capped: !!r.capped,
      xpTotal: r.xp_total,
      detail: r.detail || [],
      alreadyScored: !!r.already_scored
    };
  }

  /* ---------- statistik & kuota ---------- */

  async function refreshStats() {
    _stats = await API.rpc('get_my_stats');
    return _stats;
  }

  function quota() {
    const s = _stats || {};
    return {
      roundsLeft: Math.max(0, CFG.MAX_ROUNDS_PER_DAY - (s.rounds_today || 0)),
      xpLeft: Math.max(0, CFG.MAX_XP_PER_DAY - (s.xp_today || 0)),
      roundsToday: s.rounds_today || 0,
      xpToday: s.xp_today || 0
    };
  }

  function canPlay() {
    const q = quota();
    if (q.roundsLeft <= 0) {
      return { ok: false, reason: PESAN.DAILY_ROUNDS_LIMIT };
    }
    if (q.xpLeft <= 0) {
      return { ok: false, reason: PESAN.DAILY_XP_LIMIT };
    }
    return { ok: true, reason: '' };
  }

  function stats() {
    const s = _stats || {};
    return {
      xpTotal: s.xp_total || 0,
      rounds: s.rounds || 0,
      best: s.best || 0,
      accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : 0
    };
  }

  /* ---------- hapus data (arsitektur §12.3) ---------- */

  async function reset() {
    try {
      await API.rpc('delete_my_data');
    } catch (e) {
      /* Akun mungkin sudah tidak ada — tetap bersihkan sisi perangkat. */
    }
    API.clearSession();
    _profile = null;
    _stats = null;
  }

  return {
    init: init,
    hasProfile: hasProfile,
    profile: profile,
    createProfile: createProfile,
    startRound: startRound,
    submitAnswer: submitAnswer,
    finishRound: finishRound,
    refreshStats: refreshStats,
    quota: quota,
    canPlay: canPlay,
    stats: stats,
    reset: reset,
    friendly: friendly
  };
})();
