/* ============================================================
   api.js — Lapisan data OFFLINE-FIRST
   ------------------------------------------------------------
   • MODE LOKAL   : belum ada URL API → semua data hanya di
                    browser ini (cocok dicoba tanpa spreadsheet)
   • MODE ONLINE  : URL API (Apps Script) terisi & terjangkau →
                    setiap mutasi langsung dikirim ke spreadsheet
   • MODE OFFLINE : URL terisi tapi tak ada jaringan → mutasi
                    diterapkan lokal + masuk ANTRIAN SINKRON,
                    otomatis dikirim ulang saat online kembali
   ============================================================ */

const QUEUE_KEY = 'kp_sync_queue_v1';

const api = {
  apiUrl: '',
  status: 'lokal', // 'lokal' | 'online' | 'offline'

  init() { this.apiUrl = (localStorage.getItem('kp_api_url') || '').trim(); },

  saveUrl(url) {
    this.apiUrl = (url || '').trim();
    if (this.apiUrl) localStorage.setItem('kp_api_url', this.apiUrl);
    else localStorage.removeItem('kp_api_url');
  },

  /* ---------- antrian sinkron ---------- */
  queue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; } },
  saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); },
  enqueue(op) { const q = this.queue(); q.push(op); this.saveQueue(q); },
  clearQueue() { localStorage.removeItem(QUEUE_KEY); },

  /* ---------- util jaringan ---------- */
  async _fetchJson(url, opts) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
      return await r.json();
    } finally { clearTimeout(t); }
  },

  _sep() { return this.apiUrl.includes('?') ? '&' : '?'; },

  async ping(url) {
    const u = ((url || this.apiUrl) || '').trim();
    if (!u) throw new Error('URL masih kosong.');
    const sep = u.includes('?') ? '&' : '?';
    const j = await this._fetchJson(u + sep + 'action=ping');
    if (!j || !j.ok) throw new Error((j && j.error) || 'Respons tidak dikenal.');
    return j;
  },

  async _serverCall(op) {
    return await this._fetchJson(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari preflight CORS
      body: JSON.stringify(Object.assign({ action: op.action }, op.data)),
    });
  },

  /* ---------- baca database ---------- */
  async getDb() {
    if (this.apiUrl && navigator.onLine !== false) {
      try {
        const j = await this._fetchJson(this.apiUrl + this._sep() + 'action=all');
        if (j && j.ok) {
          this.status = 'online';
          demo._db = this._normalize(j.db);
          demo.save();
          return demo.getDb();
        }
        throw new Error((j && j.error) || 'Respons tidak dikenal.');
      } catch (e) { this.status = 'offline'; }
    } else {
      this.status = this.apiUrl ? 'offline' : 'lokal';
    }
    return demo.getDb();
  },

  /* ---------- mutasi (tambah/edit/hapus) ---------- */
  async post(action, data = {}) {
    // 1) terapkan lokal dulu → UI selalu responsif, tetap jalan saat offline
    const extra = demo.perform(action, data);
    let db = demo.getDb();

    if (this.apiUrl) {
      const op = { action, data, ts: new Date().toISOString() };
      if (navigator.onLine === false) {
        this.enqueue(op);
        this.status = 'offline';
      } else {
        try {
          const r = await this._serverCall(op);
          if (!r || !r.ok) throw new Error((r && r.error) || 'Server menolak.');
          if (r.db) { demo._db = this._normalize(r.db); demo.save(); db = demo.getDb(); }
          this.status = 'online';
        } catch (e) {
          this.enqueue(op);
          this.status = 'offline';
          toast('Koneksi ke spreadsheet gagal — tersimpan lokal & masuk antrian sinkron.', 'err');
        }
      }
    }
    return { extra, db };
  },

  /* ---------- kirim antrian saat online ---------- */
  async sync() {
    if (!this.apiUrl) return { done: 0, left: this.queue().length };
    if (navigator.onLine === false) return { done: 0, left: this.queue().length };
    let q = this.queue();
    let done = 0;
    while (q.length) {
      const op = q[0];
      try {
        const r = await this._serverCall(op);
        if (!r || !r.ok) throw new Error((r && r.error) || 'Server menolak.');
        if (r.db) { demo._db = this._normalize(r.db); demo.save(); }
        q.shift();
        this.saveQueue(q);
        done++;
      } catch (e) {
        this.status = navigator.onLine === false ? 'offline' : 'online';
        return { done, left: q.length, error: e.message };
      }
    }
    this.status = 'online';
    try { // tarikan data terbaru dari server
      const j = await this._fetchJson(this.apiUrl + this._sep() + 'action=all');
      if (j && j.ok) { demo._db = this._normalize(j.db); demo.save(); }
    } catch (e) {}
    return { done, left: 0 };
  },

  _normalize(db) {
    return {
      settings: (db && db.settings) || Object.assign({}, SETTINGS_DEFAULT),
      master: (db && db.master) || [],
      transactions: (db && db.transactions) || [],
      expenses: (db && db.expenses) || [],
    };
  },
};
