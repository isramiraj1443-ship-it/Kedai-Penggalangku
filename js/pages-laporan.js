/* ============================================================
   pages-laporan.js — Laporan Bulanan, Profit, Pengaturan
   ============================================================ */

/* ---------------- LAPORAN BULANAN ---------------- */
function renderLaporan(c, db) {
  const card = h('div', { class: 'card' }, [
    h('h3', {}, ['📅 Laporan Bulanan']),
    h('div', { class: 'sub' }, ['Sesuai sheet Lap-<Bulan> di spreadsheet: sheet bulan dibuat otomatis saat transaksi pertama bulan itu terjadi. 🔒 Baca-saja — data dihitung otomatis; koreksi dilakukan lewat menu Transaksi / Belanja.']),
  ]);

  const now = new Date();
  const avail = [...new Set(db.transactions.map(t => String(t.waktu).slice(0, 7)))].sort();
  const selY = h('select'), selM = h('select');
  const years = [...new Set(avail.map(k => k.slice(0, 4)))];
  if (!years.length) years.push(String(now.getFullYear()));
  const defY = state.lapY || String(Math.max(...years.map(Number)));
  years.forEach(y => selY.appendChild(h('option', { value: y, selected: y === defY }, [y])));
  BULAN.forEach((b, i) => {
    const val = String(i);
    const defM = state.lapM !== undefined ? String(state.lapM) : String(now.getMonth());
    selM.appendChild(h('option', { value: val, selected: val === defM }, [b]));
  });
  [selY, selM].forEach(s => { s.style.border = '1.5px solid var(--line)'; s.style.borderRadius = '10px'; s.style.padding = '9px 12px'; });

  const body = h('div');
  function paint() {
    state.lapY = selY.value; state.lapM = Number(selM.value);
    body.innerHTML = '';
    const rows = laporanBulan(db, Number(selY.value), Number(selM.value));
    if (!rows.length) {
      body.appendChild(h('div', { class: 'empty-note' }, ['Belum ada aktivitas stok/penjualan di bulan ini. Sheet bulan akan dibuat otomatis saat transaksi pertama.']));
      return;
    }
    const wrap = h('div', { class: 'tbl-wrap' });
    const tbl = h('table', { class: 'tbl' });
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', {}, ['Barang_Id']), h('th', {}, ['Kode Barang']), h('th', {}, ['Nama Barang']),
      h('th', { class: 'num' }, ['Jumlah Stok']), h('th', { class: 'num' }, ['Jumlah Terjual']),
      h('th', { class: 'num' }, ['Harga Bayar']), h('th', { class: 'num' }, ['Sisa Stok']),
      h('th', { class: 'num' }, ['Jml Pot. Kas']), h('th', { class: 'num' }, ['Jml Pot. Upah']), h('th', {}, ['Created At']),
    ])]));
    const tb = h('tbody');
    let tStok = 0, tJual = 0, tOmzet = 0, tSisa = 0, tKas = 0, tUpah = 0;
    rows.forEach(r => {
      tStok += r.stok; tJual += r.terjual; tOmzet += r.omzet; tSisa += Math.max(0, r.sisa); tKas += r.potKas; tUpah += r.potUpah;
      tb.appendChild(h('tr', {}, [
        h('td', {}, [h('b', {}, [r.id])]),
        h('td', {}, [h('span', { class: 'chip ' + (r.kategori === 'Atribut Wajib' ? 'wajib' : 'pelengkap') }, [r.kategori.replace('Atribut ', '')])]),
        h('td', {}, [r.nama]),
        h('td', { class: 'num' }, [fmtNum(r.stok)]),
        h('td', { class: 'num' }, [h('b', {}, [fmtNum(r.terjual)])]),
        h('td', { class: 'num' }, [fmtIDR(r.omzet)]),
        h('td', { class: 'num' }, [fmtNum(r.sisa)]),
        h('td', { class: 'num' }, [fmtIDR(r.potKas)]),
        h('td', { class: 'num' }, [fmtIDR(r.potUpah)]),
        h('td', {}, [fmtDateTime(r.createdAt)]),
      ]));
    });
    tbl.appendChild(tb);
    tbl.appendChild(h('tfoot', {}, [h('tr', {}, [
      h('td', {}, ['TOTAL']), h('td'), h('td'),
      h('td', { class: 'num' }, [fmtNum(tStok)]), h('td', { class: 'num' }, [fmtNum(tJual)]),
      h('td', { class: 'num' }, [fmtIDR(tOmzet)]), h('td', { class: 'num' }, [fmtNum(tSisa)]),
      h('td', { class: 'num' }, [fmtIDR(tKas)]), h('td', { class: 'num' }, [fmtIDR(tUpah)]), h('td'),
    ])]));
    wrap.appendChild(tbl);
    body.appendChild(wrap);

    const btnCSV = h('button', { class: 'btn', style: 'margin-top:12px' }, ['⬇️ Unduh CSV']);
    btnCSV.addEventListener('click', () => downloadCSV(
      'Laporan-' + BULAN[Number(selM.value)] + '-' + selY.value + '.csv',
      ['Barang_Id', 'Kode Barang', 'Nama Barang', 'Jumlah Stok', 'Jumlah Terjual', 'Harga Bayar', 'Sisa Stok', 'Jumlah Potongan Kas', 'Jumlah Potongan Upah', 'Created At'],
      rows.map(r => [r.id, r.kategori, r.nama, r.stok, r.terjual, Math.round(r.omzet), r.sisa, Math.round(r.potKas), Math.round(r.potUpah), r.createdAt])
    ));
    body.appendChild(btnCSV);
  }
  selY.addEventListener('change', paint);
  selM.addEventListener('change', paint);

  card.appendChild(h('div', { class: 'form-row', style: 'margin-bottom:14px' }, [
    h('label', { style: 'font-weight:700;font-size:12px;color:var(--ink-2)' }, ['Bulan:']), selM, selY,
  ]));
  card.appendChild(body);
  paint();
  c.appendChild(card);
}

/* ---------------- PROFIT ---------------- */
function renderProfit(c, db) {
  const rows = profitRows(db);
  const card = h('div', { class: 'card' }, [
    h('h3', {}, ['📈 Sheet Profit — Rekapan per Bulan']),
    h('div', { class: 'sub' }, ['Margin = harga jual satuan − harga beli satuan. Total margin dihitung dari jumlah terjual. 🔒 Baca-saja — koreksi lewat menu Transaksi.']),
  ]);
  if (!rows.length) {
    card.appendChild(h('div', { class: 'empty-note' }, ['Belum ada penjualan.']));
    c.appendChild(card); return;
  }

  const wrap = h('div', { class: 'tbl-wrap' });
  const tbl = h('table', { class: 'tbl' });
  tbl.appendChild(h('thead', {}, [h('tr', {}, [
    h('th', {}, ['Nama Bulan']), h('th', {}, ['Barang_Id']), h('th', {}, ['Nama Barang']),
    h('th', { class: 'num' }, ['Jumlah Stok Terjual']), h('th', { class: 'num' }, ['Sisa Stok']),
    h('th', { class: 'num' }, ['Margin Satuan']), h('th', { class: 'num' }, ['Total Margin']),
  ])]));
  const tb = h('tbody');
  let lastKey = null, grand = 0;
  rows.forEach(r => {
    const key = r.tahun + '-' + r.bulan0;
    if (lastKey !== key) {
      tb.appendChild(h('tr', {}, [h('td', { colspan: 7, style: 'background:#f1f5f9;font-weight:800' }, ['— ' + r.bulan + ' ' + r.tahun + ' —'])]));
      lastKey = key;
    }
    grand += r.totalMargin;
    tb.appendChild(h('tr', {}, [
      h('td', {}, [r.bulan + ' ' + r.tahun]), h('td', {}, [r.id]), h('td', {}, [r.nama]),
      h('td', { class: 'num' }, [fmtNum(r.terjual)]), h('td', { class: 'num' }, [fmtNum(r.sisa)]),
      h('td', { class: 'num' }, [fmtIDR(r.marginSat)]),
      h('td', { class: 'num' }, [h('b', {}, [fmtIDR(r.totalMargin)])]),
    ]));
  });
  tbl.appendChild(tb);
  tbl.appendChild(h('tfoot', {}, [h('tr', {}, [
    h('td', {}, ['TOTAL MARGIN KOTOR']), h('td'), h('td'), h('td'), h('td'), h('td'),
    h('td', { class: 'num' }, [fmtIDR(grand)]),
  ])]));
  wrap.appendChild(tbl);
  card.appendChild(wrap);

  const btnCSV = h('button', { class: 'btn', style: 'margin-top:12px' }, ['⬇️ Unduh CSV']);
  btnCSV.addEventListener('click', () => downloadCSV('Profit.csv',
    ['Nama Bulan', 'Tahun', 'Barang_Id', 'Nama Barang', 'Jumlah Stok Terjual', 'Sisa Stok', 'Margin Satuan', 'Total Margin'],
    rows.map(r => [r.bulan, r.tahun, r.id, r.nama, r.terjual, r.sisa, Math.round(r.marginSat), Math.round(r.totalMargin)])));
  card.appendChild(btnCSV);
  c.appendChild(card);
}

/* ---------------- PENGATURAN ---------------- */
function renderPengaturan(c, db) {
  const s = db.settings;

  /* koneksi */
  const cardConn = h('div', { class: 'card' }, [
    h('h3', {}, ['🔗 Koneksi ke Spreadsheet (Mode Live)']),
    h('div', { class: 'sub' }, [
      'Tempel URL deployment Apps Script (berakhiran /exec) hasil langkah di PANDUAN-DEPLOY.md. Spreadsheet ID terkunci: ',
      h('code', { style: 'font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:6px' }, ['1MFWVYJyyYcA28L5wUX4-K7LrXfgO6cGMakHF8E0IFQw']),
    ]),
  ]);
  const urlInput = h('input', { placeholder: 'https://script.google.com/macros/s/…/exec', value: api.apiUrl || '' });
  urlInput.style.cssText = 'flex:1;min-width:220px;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;outline:none';
  const statusEl = h('div', { class: 'hint', style: 'margin-top:8px' },
    [api.mode === 'live' ? '✅ Terhubung ke spreadsheet (MODE LIVE).' : 'ℹ️ Saat ini MODE DEMO (data contoh tersimpan di browser).']);
  const btnTest = h('button', { class: 'btn' }, ['📡 Uji Koneksi']);
  const btnLive = h('button', { class: 'btn primary' }, ['Gunakan & Simpan']);
  const btnDemo = h('button', { class: 'btn ghost' }, ['Kembali ke Mode Demo']);

  btnTest.addEventListener('click', async () => {
    btnTest.disabled = true; statusEl.textContent = '⏳ Menguji koneksi…';
    try {
      const j = await api.pingLive(urlInput.value);
      statusEl.innerHTML = '';
      statusEl.append('✅ Terhubung! Server: "' + (j.app || 'Apps Script') + '" • sheet tersedia: ' + (j.sheets || '?') + '.');
    } catch (e) {
      statusEl.textContent = '❌ Gagal: ' + (e.name === 'AbortError' ? 'waktu habis (20 detik).' : e.message);
    }
    btnTest.disabled = false;
  });
  btnLive.addEventListener('click', async () => {
    try {
      await api.pingLive(urlInput.value);
      api.saveUrl(urlInput.value.trim());
      api.mode = 'live';
      toast('Mode LIVE aktif. Memuat data dari spreadsheet…');
      await bootLoad();
    } catch (e) { toast('Koneksi gagal: ' + e.message, 'err'); }
  });
  btnDemo.addEventListener('click', () => {
    api.saveUrl(''); api.mode = 'demo';
    toast('Kembali ke Mode Demo.');
    bootLoad();
  });
  cardConn.appendChild(h('div', { class: 'form-row' }, [urlInput, btnTest, btnLive, btnDemo]));
  cardConn.appendChild(statusEl);
  c.appendChild(cardConn);

  /* rumus */
  const cardF = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['🧮 Rumus yang Berlaku']),
    h('div', { class: 'sub' }, ['Semua perhitungan memakai rumus ini, baik di aplikasi maupun di Apps Script.']),
  ]);
  const formulas = [
    ['Harga Beli Satuan', 'Harga Beli Total ÷ Jumlah Dibeli'],
    ['Potongan Kas', '1% × Harga Beli Satuan'],
    ['Potongan Upah', '3 × (1,5% × Harga Beli Satuan) = 4,5%'],
    ['Harga Jual Satuan Bulat', 'dibulatkan ke atas dari (HBS + Pot. Kas + Pot. Upah) ke kelipatan Rp ' + fmtNum(s.pembulatan)],
    ['Margin', 'Harga Jual Satuan − Harga Beli Satuan'],
    ['Laba Bersih', 'Margin − Pot. Kas − Pot. Upah − Pengeluaran Lain'],
    ['% Untung/Rugi per bulan', '(Laba Bersih ÷ Omzet) × 100%'],
  ];
  const wrap = h('div', { class: 'tbl-wrap' });
  const tbl = h('table', { class: 'tbl' });
  tbl.appendChild(h('thead', {}, [h('tr', {}, [h('th', {}, ['Komponen']), h('th', {}, ['Rumus'])])]));
  const tb = h('tbody');
  formulas.forEach(([k, v]) => tb.appendChild(h('tr', {}, [h('td', {}, [h('b', {}, [k])]), h('td', {}, [v])])));
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  cardF.appendChild(wrap);
  c.appendChild(cardF);

  /* zona demo */
  if (api.mode === 'demo') {
    const cardZ = h('div', { class: 'card', style: 'margin-top:16px' }, [
      h('h3', {}, ['🎮 Data Demo']),
      h('div', { class: 'sub' }, ['Mode demo menyimpan data di browser ini. Semua transaksi yang Anda coba di sini bersifat simulasi.']),
      h('button', { class: 'btn danger', onclick: () => confirmModal('Reset data demo?',
        'Semua perubahan demo akan dikembalikan ke data awal.',
        () => { demo.reset(); state.cart = {}; toast('Data demo direset.'); bootLoad(); }, 'Reset', true) }, ['♻️ Reset Data Demo']),
    ]);
    c.appendChild(cardZ);
  }
}
