/* ==========================================================================
   api.js — klien Supabase kecil, tanpa pustaka eksternal
   --------------------------------------------------------------------------
   Kenapa tidak memakai supabase-js dari CDN:
     - menambah ~120 KB dan satu titik gagal di jaringan sekolah;
     - brief melarang ketergantungan luar.

   Yang dipakai hanya tiga endpoint HTTP biasa:
     POST /auth/v1/signup              -> masuk sebagai pemain anonim
     POST /auth/v1/token?grant_type=…  -> perbarui token
     POST /rest/v1/rpc/<fungsi>        -> panggil fungsi database
   ========================================================================== */

window.MHT = window.MHT || {};

MHT.api = (function () {
  const CFG = MHT.config;
  const BASE = String(CFG.SUPABASE_URL || '').replace(/\/+$/, '');
  const KEY = CFG.SUPABASE_KEY || '';
  const SESSION_KEY = 'mht.session.v1';

  let session = null;
  let pending = null; /* mencegah dua proses masuk berbarengan */

  /* ---------- sesi tersimpan ---------- */

  function loadSession() {
    if (session) return session;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.access_token && s.refresh_token) session = s;
      }
    } catch (e) { /* rusak -> masuk ulang */ }
    return session;
  }

  function saveSession(s) {
    session = s;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* abaikan */ }
    return s;
  }

  function clearSession() {
    session = null;
    pending = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* abaikan */ }
  }

  /* ---------- permintaan HTTP ---------- */

  function wrapError(e) {
    const err = new Error(
      (e && (e.message || e.error_description || e.msg)) || 'Gagal menghubungi server.'
    );
    err.status = e && e.status;
    err.code = (e && (e.error_code || e.code)) || null;
    return err;
  }

  async function req(path, opt) {
    opt = opt || {};
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (opt.token) headers.Authorization = 'Bearer ' + opt.token;

    let res;
    try {
      res = await fetch(BASE + path, {
        method: opt.method || 'GET',
        headers: headers,
        body: opt.body === undefined ? undefined : JSON.stringify(opt.body)
      });
    } catch (e) {
      const err = new Error('NETWORK');
      err.code = 'NETWORK';
      throw err;
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
    }

    if (!res.ok) {
      const err = wrapError(data || {});
      err.status = res.status;
      if (data && data.code) err.code = data.error_code || data.code;
      if (data && data.message) err.message = data.message;
      throw err;
    }
    return data;
  }

  /* ---------- autentikasi ---------- */

  async function signInAnonymous() {
    const data = await req('/auth/v1/signup', {
      method: 'POST',
      body: { data: {}, gotrue_meta_security: {} }
    });

    if (!data || !data.access_token) {
      const err = new Error('Server tidak memberi sesi.');
      err.code = 'NO_SESSION';
      throw err;
    }

    return saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + ((data.expires_in || 3600) * 1000) - 60000,
      user_id: data.user && data.user.id
    });
  }

  async function refreshSession() {
    const cur = loadSession();
    if (!cur) return signInAnonymous();

    try {
      const data = await req('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: cur.refresh_token }
      });
      return saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + ((data.expires_in || 3600) * 1000) - 60000,
        user_id: (data.user && data.user.id) || cur.user_id
      });
    } catch (e) {
      /* token kedaluwarsa total -> pemain baru */
      clearSession();
      return signInAnonymous();
    }
  }

  function ensureSession() {
    if (pending) return pending;

    const cur = loadSession();
    if (cur && Date.now() < cur.expires_at) return Promise.resolve(cur);

    pending = (cur ? refreshSession() : signInAnonymous())
      .then(function (s) { pending = null; return s; })
      .catch(function (e) { pending = null; throw e; });

    return pending;
  }

  /* ---------- panggilan data ---------- */

  async function call(path, opt) {
    await ensureSession();

    try {
      return await req(path, Object.assign({}, opt, { token: session.access_token }));
    } catch (e) {
      if (e.status === 401) {
        await refreshSession();
        return req(path, Object.assign({}, opt, { token: session.access_token }));
      }
      throw e;
    }
  }

  function rpc(name, args) {
    return call('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} });
  }

  function select(table, query) {
    return call('/rest/v1/' + table + (query ? '?' + query : ''), { method: 'GET' });
  }

  return {
    ensureSession: ensureSession,
    clearSession: clearSession,
    rpc: rpc,
    select: select,
    userId: function () { return session && session.user_id; }
  };
})();
