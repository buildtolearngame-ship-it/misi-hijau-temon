/* ==========================================================================
   app.js — alur layar dan jalannya satu ronde
   --------------------------------------------------------------------------
   Perbedaan penting dari Tahap 1:
     - setiap ketukan dikirim ke server, dan server yang menjawab benar/salah;
     - skor dan Bintang Hijau berasal dari server, bukan dihitung di sini;
     - ronde yang ditinggalkan bisa dilanjutkan tanpa kehilangan jatah harian.
   ========================================================================== */

window.MHT = window.MHT || {};

(function () {
  const CFG = MHT.config;
  const STORE = MHT.store;

  /* ---------- util ---------- */

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function binById(id) {
    for (let i = 0; i < CFG.BINS.length; i++) {
      if (CFG.BINS[i].id === id) return CFG.BINS[i];
    }
    return CFG.BINS[0];
  }

  function avatarById(id) {
    for (let i = 0; i < CFG.AVATARS.length; i++) {
      if (CFG.AVATARS[i].id === id) return CFG.AVATARS[i];
    }
    return CFG.AVATARS[0];
  }

  function leagueById(id) {
    for (let i = 0; i < CFG.LEAGUES.length; i++) {
      if (CFG.LEAGUES[i].id === id) return CFG.LEAGUES[i];
    }
    return CFG.LEAGUES[0];
  }

  function randomNickname() {
    const w = CFG.NICKNAME_WORDS[Math.floor(Math.random() * CFG.NICKNAME_WORDS.length)];
    const n = String(Math.floor(Math.random() * 90) + 10);
    return w + '-' + n;
  }

  /* ---------- state ---------- */

  const state = {
    draft: {
      league: null,
      nickname: randomNickname(),
      avatarId: CFG.AVATARS[0].id
    },
    round: null,
    bootOk: false
  };

  /* ---------- navigasi layar ---------- */

  let current = 'start';

  function show(name) {
    $$('.screen').forEach(function (el) {
      el.classList.toggle('is-active', el.dataset.screen === name);
    });
    current = name;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }

  /* ---------- modal ---------- */

  let modalHandler = null;

  function openModal(opt) {
    $('#modal-title').textContent = opt.title || 'Yakin?';
    $('#modal-text').textContent = opt.text || '';
    const confirmBtn = $('#modal-confirm');
    confirmBtn.textContent = opt.confirmLabel || 'Ya';
    confirmBtn.className = 'btn ' + (opt.danger ? 'btn--danger' : 'btn--primary');

    const cancelBtn = document.querySelector('[data-action="modal-cancel"]');
    cancelBtn.hidden = !!opt.hideCancel;

    modalHandler = opt.onConfirm || null;
    $('#modal').hidden = false;
  }

  function closeModal() {
    $('#modal').hidden = true;
    modalHandler = null;
  }

  function notify(title, text) {
    openModal({ title: title, text: text, confirmLabel: 'Oke', hideCancel: true });
  }

  /* ---------- layar: mulai ---------- */

  function setStartState(mode, msg) {
    const btn = document.querySelector('[data-action="start"]');
    const st = $('#boot-status');
    if (!btn) return;

    if (mode === 'loading') {
      btn.disabled = true;
      btn.textContent = 'Menyiapkan…';
      if (st) { st.textContent = 'Menghubungkan ke server…'; st.hidden = false; }
    } else if (mode === 'error') {
      btn.disabled = false;
      btn.textContent = 'Coba Lagi';
      if (st) { st.textContent = msg || 'Gagal menghubungi server.'; st.hidden = false; }
    } else {
      btn.disabled = false;
      btn.textContent = STORE.hasProfile() ? 'Lanjut Main' : 'Mulai';
      if (st) { st.textContent = ''; st.hidden = true; }
    }
  }

  /* ---------- layar: setup ---------- */

  function renderSetup() {
    const list = $('#league-list');
    list.innerHTML = '';
    CFG.LEAGUES.forEach(function (lg) {
      const b = document.createElement('button');
      b.className = 'league';
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.draft.league === lg.id));
      b.dataset.league = lg.id;
      b.innerHTML =
        '<span class="league__emoji" aria-hidden="true">' + lg.emoji + '</span>' +
        '<span class="league__body">' +
          '<span class="league__name">' + lg.label + '</span>' +
          '<span class="league__grades">' + lg.grades + '</span>' +
        '</span>' +
        '<span class="league__check" aria-hidden="true">✓</span>';
      b.addEventListener('click', function () {
        state.draft.league = lg.id;
        renderSetup();
        syncSetupButton();
      });
      list.appendChild(b);
    });

    const grid = $('#avatar-grid');
    grid.innerHTML = '';
    CFG.AVATARS.forEach(function (av) {
      const b = document.createElement('button');
      b.className = 'avatar';
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.draft.avatarId === av.id));
      b.setAttribute('aria-label', 'Gambar ' + av.emoji);
      b.textContent = av.emoji;
      b.addEventListener('click', function () {
        state.draft.avatarId = av.id;
        renderSetup();
        syncSetupButton();
      });
      grid.appendChild(b);
    });

    $('#nickname-value').textContent = state.draft.nickname;
    syncSetupButton();
  }

  function syncSetupButton() {
    const btn = document.querySelector('[data-action="confirm-setup"]');
    btn.disabled = !state.draft.league;
  }

  /* ---------- layar: beranda ---------- */

  function renderHome() {
    const p = STORE.profile();
    if (!p) { show('start'); return; }

    $('#home-avatar').textContent = avatarById(p.avatar_id).emoji;
    $('#home-name').textContent = p.nickname;
    $('#home-league').textContent =
      leagueById(p.league).label + ' · ' + leagueById(p.league).grades;
    $('#home-xp').textContent = STORE.stats().xpTotal;

    const q = STORE.quota();
    const cek = STORE.canPlay();
    $('#home-quota').textContent = cek.ok
      ? 'Sisa ' + q.roundsLeft + ' kali main hari ini'
      : cek.reason;
  }

  /* ---------- layar: main ---------- */

  function setBinsEnabled(on) {
    $$('.bin').forEach(function (b) { b.disabled = !on; });
  }

  function setHint(text) {
    const el = $('#play-hint');
    if (el) el.textContent = text;
  }

  async function startRound() {
    const cek = STORE.canPlay();
    if (!cek.ok) {
      notify('Sudah cukup untuk hari ini', cek.reason);
      return;
    }

    const btn = document.querySelector('[data-action="play"]');
    if (btn) btn.disabled = true;

    let r;
    try {
      r = await STORE.startRound();
    } catch (e) {
      if (btn) btn.disabled = false;
      notify('Tidak bisa mulai', STORE.friendly(e));
      return;
    }
    if (btn) btn.disabled = false;

    if (!r.items.length) {
      notify('Soal belum siap', 'Bank soal di server masih kosong.');
      return;
    }

    state.round = {
      roundId: r.roundId,
      items: r.items,
      index: r.nextIndex === -1 ? r.items.length : r.nextIndex,
      answers: [],
      resumed: r.resumed,
      locked: false
    };

    /* Semua soal sudah dijawab tetapi ronde belum dinilai. */
    if (r.nextIndex === -1) { await finishRound(); return; }

    renderBins();
    renderQuestion();
    show('play');
  }

  function renderBins() {
    const wrap = $('#bins');
    wrap.innerHTML = '';
    CFG.BINS.forEach(function (bin) {
      const b = document.createElement('button');
      b.className = 'bin';
      b.type = 'button';
      b.dataset.bin = bin.id;
      b.style.setProperty('--bin-color', bin.color);
      b.innerHTML =
        '<span class="bin__emoji" aria-hidden="true">' + bin.emoji + '</span>' +
        '<span class="bin__name">' + bin.label + '</span>' +
        '<span class="bin__hint">' + bin.hint + '</span>';
      b.addEventListener('click', function () { answer(bin.id); });
      wrap.appendChild(b);
    });
  }

  function renderQuestion() {
    const r = state.round;
    const item = r.items[r.index];

    r.locked = false;

    $('#item-emoji').textContent = item.emoji;
    $('#item-name').textContent = item.name;
    $('#play-count').textContent = (r.index + 1) + '/' + r.items.length;
    $('#progress-fill').style.width = (r.index / r.items.length * 100) + '%';

    setHint(r.resumed && r.index > 0 ? 'Melanjutkan ronde tadi' : 'Ketuk salah satu tempat sampah');
    setBinsEnabled(true);

    const card = $('#item-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }

  async function answer(binId) {
    const r = state.round;
    if (!r || r.locked) return;

    const item = r.items[r.index];

    r.locked = true;
    setBinsEnabled(false);
    setHint('Memeriksa…');

    let res;
    try {
      res = await STORE.submitAnswer(r.roundId, item.id, binId);
    } catch (e) {
      /* Jawaban tidak tercatat: buka lagi supaya anak bisa mencoba. */
      r.locked = false;
      setBinsEnabled(true);
      setHint('Ketuk salah satu tempat sampah');
      notify('Koneksi bermasalah', STORE.friendly(e));
      return;
    }

    r.answers.push({ itemId: item.id, bin: binId, correct: res.correct });
    showFeedback(item, binId, res);
  }

  function showFeedback(item, binId, res) {
    const fb = $('#feedback');
    const rightBin = binById(res.correctBin);

    fb.classList.toggle('is-wrong', !res.correct);

    $('#feedback-badge').textContent = res.correct ? '✓' : '✕';
    $('#feedback-title').textContent = res.correct ? 'Benar!' : 'Belum tepat';

    let text = res.reason;
    if (!res.correct) {
      text = 'Tempat yang benar: ' + rightBin.label + '. ' + res.reason;
    }
    $('#feedback-reason').textContent = text;

    const last = state.round.index >= state.round.items.length - 1;
    $('#btn-next').textContent = last ? 'Lihat hasil →' : 'Lanjut →';

    fb.hidden = false;
  }

  function nextItem() {
    const r = state.round;
    if (!r) return;

    $('#feedback').hidden = true;
    r.index += 1;

    if (r.index >= r.items.length) {
      finishRound();
    } else {
      renderQuestion();
    }
  }

  async function finishRound() {
    const r = state.round;
    if (!r) return;

    setHint('Menghitung hasil…');

    let s;
    try {
      s = await STORE.finishRound(r.roundId);
    } catch (e) {
      notify('Hasil belum tersimpan', STORE.friendly(e));
      return;
    }

    state.round = null;
    renderResult(s);
    show('result');
  }

  /* ---------- layar: hasil ---------- */

  function renderResult(s) {
    const detail = s.detail || [];
    const wrong = detail.filter(function (d) { return !d.correct; });

    let emoji = '🌱';
    let title = 'Awal yang bagus!';
    if (s.score === s.total) { emoji = '🏆'; title = 'Sempurna! Semua benar!'; }
    else if (s.score >= 8) { emoji = '🌟'; title = 'Hebat sekali!'; }
    else if (s.score >= 5) { emoji = '👍'; title = 'Bagus, terus belajar!'; }

    let html = '' +
      '<div class="result__score">' +
        '<div class="result__emoji" aria-hidden="true">' + emoji + '</div>' +
        '<div class="result__big">' + s.score + ' / ' + s.total + '</div>' +
        '<div class="result__label">' + title + '</div>' +
        '<div class="result__xp">+' + s.xp + ' Bintang Hijau</div>' +
        (s.capped
          ? '<div class="result__label">Batas poin hari ini tercapai, jadi poin dipotong.</div>'
          : '') +
      '</div>';

    if (wrong.length) {
      html += '<div><p class="result__title">Yang perlu diingat</p><div class="recap">';
      wrong.forEach(function (d) {
        html += '' +
          '<div class="recap__row">' +
            '<span class="recap__emoji" aria-hidden="true">' + d.emoji + '</span>' +
            '<span class="recap__body">' +
              '<span class="recap__name">' + d.name + '</span>' +
              '<span class="recap__bin">Masuk ' + binById(d.correct_bin).label + '</span>' +
              '<span class="recap__bin">' + d.reason + '</span>' +
            '</span>' +
          '</div>';
      });
      html += '</div></div>';
    } else {
      html += '<div class="notice notice--soft">Semua benar. Coba lagi besok untuk poin baru!</div>';
    }

    $('#result-body').innerHTML = html;

    const again = $('#btn-again');
    const cek = STORE.canPlay();
    again.disabled = !cek.ok;
    again.textContent = cek.ok
      ? 'Main Lagi (' + STORE.quota().roundsLeft + 'x lagi)'
      : 'Main lagi besok';
  }

  /* ---------- layar: profil ---------- */

  function renderProfile() {
    const p = STORE.profile();
    if (!p) { show('start'); return; }

    const lg = leagueById(p.league);
    const st = STORE.stats();

    $('#profile-avatar').textContent = avatarById(p.avatar_id).emoji;
    $('#profile-name').textContent = p.nickname;
    $('#profile-league').textContent = lg.label + ' · ' + lg.grades;
    $('#profile-code').textContent = p.public_code;

    $('#profile-stats').innerHTML = '' +
      '<div class="stat"><span class="stat__value">' + st.xpTotal + '</span><span class="stat__label">Bintang Hijau</span></div>' +
      '<div class="stat"><span class="stat__value">' + st.rounds + '</span><span class="stat__label">Ronde dimainkan</span></div>' +
      '<div class="stat"><span class="stat__value">' + st.best + '/10</span><span class="stat__label">Skor terbaik</span></div>' +
      '<div class="stat"><span class="stat__value">' + st.accuracy + '%</span><span class="stat__label">Ketepatan</span></div>';
  }

  /* ---------- aksi ---------- */

  const actions = {
    'start': function () {
      if (!state.bootOk) { boot(); return; }
      if (STORE.hasProfile()) { renderHome(); show('home'); }
      else { renderSetup(); show('setup'); }
    },

    'back-start': function () { show('start'); },

    'shuffle-name': function () {
      state.draft.nickname = randomNickname();
      $('#nickname-value').textContent = state.draft.nickname;
    },

    'confirm-setup': async function () {
      if (!state.draft.league) return;

      const btn = document.querySelector('[data-action="confirm-setup"]');
      btn.disabled = true;
      btn.textContent = 'Menyimpan…';

      try {
        await STORE.createProfile({
          nickname: state.draft.nickname,
          avatarId: state.draft.avatarId,
          league: state.draft.league
        });
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Ayo Main';
        notify('Profil gagal disimpan', STORE.friendly(e));
        return;
      }

      btn.textContent = 'Ayo Main';
      renderHome();
      show('home');
    },

    'play': function () { startRound(); },

    'next-item': function () { nextItem(); },

    'quit-round': function () {
      if (!state.round) { renderHome(); show('home'); return; }
      openModal({
        title: 'Keluar dari permainan?',
        text: 'Ronde ini disimpan. Kamu bisa melanjutkannya nanti tanpa kehilangan jatah main.',
        confirmLabel: 'Ya, keluar',
        danger: true,
        onConfirm: async function () {
          state.round = null;
          $('#feedback').hidden = true;
          try { await STORE.refreshStats(); } catch (e) { /* tampilkan angka lama */ }
          renderHome();
          show('home');
        }
      });
    },

    'play-again': function () { startRound(); },

    'go-home': function () {
      $('#feedback').hidden = true;
      renderHome();
      show('home');
    },

    'open-profile': function () { renderProfile(); show('profile'); },

    'ask-delete': function () {
      openModal({
        title: 'Hapus semua progres?',
        text: 'Bintang, skor, dan nama panggilanmu akan hilang dan tidak bisa dikembalikan.',
        confirmLabel: 'Ya, hapus',
        danger: true,
        onConfirm: async function () {
          await STORE.reset();
          state.draft = { league: null, nickname: randomNickname(), avatarId: CFG.AVATARS[0].id };
          show('start');
          boot();
        }
      });
    },

    'modal-cancel': function () { closeModal(); },

    'modal-confirm': function () {
      const fn = modalHandler;
      closeModal();
      if (fn) fn();
    }
  };

  /* ---------- event delegation ---------- */

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });

  /* ---------- keyboard ---------- */

  document.addEventListener('keydown', function (e) {
    if (current !== 'play' || !state.round) return;

    if (!state.round.locked) {
      if (e.key === '1') answer(CFG.BINS[0].id);
      if (e.key === '2') answer(CFG.BINS[1].id);
      if (e.key === '3') answer(CFG.BINS[2].id);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!$('#feedback').hidden) nextItem();
    }
  });

  /* ---------- start ---------- */

  async function boot() {
    state.bootOk = false;
    setStartState('loading');
    show('start');

    try {
      await STORE.init();
    } catch (e) {
      setStartState('error', STORE.friendly(e));
      return;
    }

    state.bootOk = true;
    setStartState('ready');
  }

  boot();

  MHT.app = {
    show: show,
    startRound: startRound,
    state: state,
    boot: boot
  };
})();
