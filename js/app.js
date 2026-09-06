/* ============================================================
   app.js — router, navigasi, boot, indikator offline, auto-sync
   ============================================================ */

const PAGES = {
  dashboard:  { ic: '📊', label: 'Dashboard',        sub: 'Kesimpulan, flowchart & grafik realtime', render: renderDashboard },
  kasir:      { ic: '🛒', label: 'Kasir',            sub: 'Tetap bisa transaksi walau offline', render: renderKasir },
  belanja:    { ic: '📦', label: 'Belanja / Stok',   sub: 'Catat belanja barang masuk ke Data Master', render: renderBelanja },
  master:     { ic: '🗂️', label: 'Master Data',      sub: 'Kelola barang & harga jual (edit/hapus)', render: renderMaster },
  transaksi:  { ic: '🧾', label: 'Transaksi',        sub: 'Riwayat penjualan (edit/hapus tersedia)', render: renderTransaksi },
  pengeluaran:{ ic: '💸', label: 'Pengeluaran',      sub: 'Biaya lain-lain di luar kas & upah', render: renderPengeluaran },
  laporan:    { ic: '📅', label: 'Laporan Bulanan',  sub: 'Sheet Lap-<Bulan> — dibuat otomatis per bulan', render: renderLaporan },
  profit:     { ic: '📈', label: 'Profit',           sub: 'Rekapan margin tiap bulan', render: renderProfit },
  pengaturan: { ic: '⚙️', label: 'Pengaturan',       sub: 'Koneksi spreadsheet, antrian offline & rumus', render: renderPengaturan },
};

const state = {
  page: 'dashboard', db: null, cart: {}, payMethod: 'Tunai',
  kasirQ: '', kasirKat: 'all', trxFilter: 'all', lapY: null, lapM: undefined,
};

function renderNav() {
  const nav = document.getElementById('nav');
  const mnav = document.getElementById('mobileNav');
  nav.innerHTML = ''; mnav.innerHTML = '';
  Object.entries(PAGES).forEach(([key, p]) => {
    [nav, mnav].forEach(target => {
      const b = h('button', { class: 'nav-item' + (state.page === key ? ' active' : '') }, [
        h('span', { class: 'ic' }, [p.ic]), h('span', {}, [p.label]),
      ]);
      b.addEventListener('click', () => navigate(key));
      target.appendChild(b);
    });
  });
}

function navigate(page) {
  state.page = page;
  renderNav();
  refreshPage();
  window.scrollTo({ top: 0 });
}

function refreshPage() {
  if (!state.db) return;
  const c = document.getElementById('content');
  c.innerHTML = '';
  document.getElementById('pageTitle').textContent = PAGES[state.page].label;
  document.getElementById('pageSub').textContent = PAGES[state.page].sub;
  PAGES[state.page].render(c, state.db);
}

function updateModeUI() {
  const badge = document.getElementById('modeBadge');
  const pill = document.getElementById('modePill');
  const n = api.queue().length;
  if (api.status === 'online') {
    badge.textContent = '● ONLINE — SPREADSHEET' + (n ? ' • ' + n + ' antrian' : '');
    badge.className = 'mode-badge live';
    pill.textContent = '🟢 ONLINE'; pill.style.cssText = 'background:#def7ec;color:#057a55';
  } else if (api.status === 'offline') {
    badge.textContent = '● OFFLINE • ' + n + ' antrian sinkron';
    badge.className = 'mode-badge demo';
    pill.textContent = '📴 OFFLINE'; pill.style.cssText = 'background:#fde8e8;color:#9b1c1c';
  } else {
    badge.textContent = '● MODE LOKAL — DATA BROWSER';
    badge.className = 'mode-badge demo';
    pill.textContent = '🟡 LOKAL'; pill.style.cssText = 'background:#fef3c7;color:#b45309';
  }
  if (state.db) {
    document.getElementById('brandSub').textContent =
      (state.db.settings.namaKedai || 'Kedai Penggalangku') + ' • Offline-ready';
  }
  if (state.page === 'pengaturan') refreshPage();
}

async function bootLoad() {
  try {
    state.db = await api.getDb();
    updateModeUI();
    refreshPage();
  } catch (e) {
    document.getElementById('content').innerHTML =
      '<div class="card"><div class="empty-note">⚠️ Gagal memuat data: ' + esc(e.message) +
      '<br><br><button class="btn primary" onclick="location.reload()">Coba Lagi</button></div></div>';
  }
}

/* sinkronisasi antrian offline → spreadsheet */
async function trySync(silent) {
  if (!api.apiUrl || !api.queue().length) return;
  if (navigator.onLine === false) return;
  const r = await api.sync();
  if (r.done) {
    state.db = await api.getDb().catch(() => state.db);
    if (!silent) toast(r.done + ' perubahan offline berhasil disinkronkan.');
    else toast('🔄 ' + r.done + ' antrian offline tersinkron ke spreadsheet.');
  } else if (r.error && !silent) {
    toast('Sinkron tertunda: ' + r.error, 'err');
  }
  updateModeUI();
  refreshPage();
}

/* jam realtime */
function tickClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const d = new Date();
  el.textContent = HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() +
    ' • ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

/* init */
(async function boot() {
  renderNav();
  tickClock();
  setInterval(tickClock, 1000);

  const content = document.getElementById('content');
  content.innerHTML = '<div class="grid g4">' + Array.from({ length: 8 }).map(() => '<div class="skel"></div>').join('') + '</div>';

  api.init();
  await bootLoad();

  // sisa antrian offline dari sesi sebelumnya
  if (api.apiUrl && api.queue().length) setTimeout(() => trySync(true), 1200);

  document.getElementById('btnRefresh').addEventListener('click', async () => {
    const b = document.getElementById('btnRefresh');
    b.disabled = true;
    await bootLoad();
    await trySync(false);
    toast('Data dimuat ulang.');
    b.disabled = false;
  });

  // koneksi pulih → langsung sinkron
  window.addEventListener('online', () => {
    toast('📶 Koneksi pulih — menyinkronkan antrian…');
    bootLoad().then(() => trySync(true));
  });
  window.addEventListener('offline', () => {
    if (api.apiUrl) api.status = 'offline';
    updateModeUI();
    toast('📴 Mode offline — transaksi tetap bisa, disimpan lokal.', 'err');
  });

  // pemeriksa berkala: antrian + penyegaran data
  setInterval(() => {
    if (document.hidden) return;
    if (api.queue().length && navigator.onLine !== false) { trySync(true); return; }
    if (api.status === 'online' && ['dashboard', 'transaksi', 'laporan'].includes(state.page) && !Object.keys(state.cart).length) {
      api.getDb().then(db => { state.db = db; refreshPage(); }).catch(() => {});
    }
  }, 30000);
})();
