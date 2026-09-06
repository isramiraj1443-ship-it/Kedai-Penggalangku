/* ============================================================
   pages-settings.js — Pengaturan: koneksi spreadsheet,
   antrian sinkron offline, rumus, data lokal
   ============================================================ */

const ACTION_LABEL = {
  'purchase.add': '📦 Tambah barang belanja',
  'sale.checkout': '🛒 Penjualan kasir',
  'master.update': '✏️ Edit barang',
  'master.delete': '🗑 Hapus barang',
  'trx.update': '✏️ Edit transaksi',
  'trx.delete': '🗑 Hapus transaksi',
  'expense.add': '💸 Pengeluaran baru',
  'expense.update': '✏️ Edit pengeluaran',
  'expense.delete': '🗑 Hapus pengeluaran',
};

function renderPengaturan(c, db) {
  /* ---------- 1. koneksi spreadsheet ---------- */
  const cardConn = h('div', { class: 'card' }, [
    h('h3', {}, ['🔗 Koneksi ke Spreadsheet (via Apps Script)']),
    h('div', { class: 'sub' }, [
      'Tempel URL deployment Apps Script (berakhiran /exec) yang sudah mendukung API (Code.gs v1.2+). Spreadsheet ID terkunci: ',
      h('code', { style: 'font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:6px' }, ['1MFWVYJyyYcA28L5wUX4-K7LrXfgO6cGMakHF8E0IFQw']),
    ]),
  ]);
  const urlInput = h('input', { placeholder: 'https://script.google.com/macros/s/…/exec', value: api.apiUrl || '' });
  urlInput.style.cssText = 'flex:1;min-width:220px;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;outline:none';

  const statusEl = h('div', { class: 'hint', style: 'margin-top:9px' });
  function paintStatus() {
    statusEl.innerHTML = '';
    const n = api.queue().length;
    if (!api.apiUrl) statusEl.append('ℹ️ MODE LOKAL — data hanya tersimpan di browser ini. Tempel URL untuk terhubung ke spreadsheet.');
    else if (api.status === 'online') statusEl.append('✅ ONLINE — terhubung ke spreadsheet.' + (n ? ' ⚠️ ' + n + ' antrian belum terkirim.' : ''));
    else statusEl.append('📴 OFFLINE — bekerja dari data lokal. ' + n + ' perubahan menunggu sinkronisasi.');
  }
  paintStatus();

  const btnTest = h('button', { class: 'btn' }, ['📡 Uji Koneksi']);
  btnTest.addEventListener('click', async () => {
    btnTest.disabled = true;
    try {
      const j = await api.ping(urlInput.value);
      toast('Terhubung! Server: ' + (j.app || 'Apps Script'));
      statusEl.innerHTML = ''; statusEl.append('✅ Uji koneksi berhasil — server "' + (j.app || 'Apps Script') + '" merespons.');
    } catch (e) {
      toast('Uji koneksi gagal: ' + e.message, 'err');
    }
    btnTest.disabled = false;
  });

  const btnSave = h('button', { class: 'btn primary' }, ['💾 Simpan & Sinkronkan']);
  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    try {
      await api.ping(urlInput.value);
      api.saveUrl(urlInput.value);
      toast('URL disimpan. Melakukan sinkronisasi…');
      const r = await api.sync();
      await bootLoad();
      if (r.error) toast('Sinkron tertunda: ' + r.error + ' (' + r.left + ' antrian tersisa)', 'err');
      else if (r.done) toast(r.done + ' antrian berhasil disinkronkan.');
    } catch (e) {
      toast('Koneksi gagal: ' + e.message + ' — URL tidak disimpan.', 'err');
    }
    btnSave.disabled = false;
  });

  const btnLocal = h('button', { class: 'btn ghost' }, ['🔌 Putuskan (Mode Lokal)']);
  btnLocal.addEventListener('click', () => confirmModal('Putuskan dari spreadsheet?',
    'Aplikasi berjalan dari data lokal browser. Perubahan tidak dikirim ke spreadsheet sampai URL dipasang lagi.',
    () => { api.saveUrl(''); api.status = 'lokal'; toast('Mode Lokal aktif.'); bootLoad(); }, 'Putuskan'));

  cardConn.appendChild(h('div', { class: 'form-row' }, [urlInput, btnTest, btnSave, btnLocal]));
  cardConn.appendChild(statusEl);
  c.appendChild(cardConn);

  /* ---------- 2. antrian sinkron ---------- */
  const q = api.queue();
  const cardQ = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['🔁 Antrian Sinkronisasi (' + q.length + ')']),
    h('div', { class: 'sub' }, ['Perubahan yang dibuat saat offline. Dikirim otomatis begitu koneksi pulih, atau tekan tombol di bawah.']),
  ]);
  if (q.length) {
    const wrap = h('div', { class: 'tbl-wrap' });
    const tbl = h('table', { class: 'tbl' });
    tbl.appendChild(h('thead', {}, [h('tr', {}, [h('th', {}, ['Aksi']), h('th', {}, ['Waktu']), h('th', {}, ['Detail'])])]));
    const tb = h('tbody');
    q.forEach(op => {
      let detail = '';
      if (op.data) {
        if (op.data.nama) detail = op.data.nama;
        else if (op.data.items) detail = op.data.items.length + ' jenis barang';
        else if (op.data.id) detail = op.data.id;
        else if (op.data.trxId) detail = op.data.trxId;
        else if (op.data.keterangan) detail = op.data.keterangan;
      }
      tb.appendChild(h('tr', {}, [
        h('td', {}, [ACTION_LABEL[op.action] || op.action]),
        h('td', {}, [fmtDateTime(op.ts)]),
        h('td', {}, [detail]),
      ]));
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    cardQ.appendChild(wrap);
    const btnSync = h('button', { class: 'btn primary', style: 'margin-top:12px' }, ['🔄 Sinkron Sekarang']);
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      const r = await api.sync();
      await bootLoad();
      if (r.error) toast('Gagal di tengah: ' + r.error + ' — ' + r.left + ' antrian tersisa.', 'err');
      else toast('Sinkron selesai: ' + r.done + ' perubahan terkirim.');
      btnSync.disabled = false;
    });
    const btnClear = h('button', { class: 'btn ghost', style: 'margin-top:12px' }, ['🧹 Buang Antrian']);
    btnClear.addEventListener('click', () => confirmModal('Buang semua antrian?',
      'Perubahan offline yang belum terkirim akan DIBATALKAN kirimnya (data lokal tetap ada).',
      () => { api.clearQueue(); toast('Antrian dibuang.'); refreshPage(); }, 'Buang', true));
    cardQ.appendChild(h('div', { class: 'form-row' }, [btnSync, btnClear]));
  } else {
    cardQ.appendChild(h('div', { class: 'empty-note' }, ['Tidak ada antrian. Semua perubahan sudah tersinkron (atau Anda di Mode Lokal).']));
  }
  c.appendChild(cardQ);

  /* ---------- 3. rumus ---------- */
  const s = db.settings;
  const cardF = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['🧮 Rumus yang Berlaku']),
    h('div', { class: 'sub' }, ['Identik dengan perhitungan di Apps Script/spreadsheet.']),
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
  const wrapF = h('div', { class: 'tbl-wrap' });
  const tblF = h('table', { class: 'tbl' });
  tblF.appendChild(h('thead', {}, [h('tr', {}, [h('th', {}, ['Komponen']), h('th', {}, ['Rumus'])])]));
  const tbF = h('tbody');
  formulas.forEach(([k, v]) => tbF.appendChild(h('tr', {}, [h('td', {}, [h('b', {}, [k])]), h('td', {}, [v])])));
  tblF.appendChild(tbF);
  wrapF.appendChild(tblF);
  cardF.appendChild(wrapF);
  c.appendChild(cardF);

  /* ---------- 4. data lokal ---------- */
  const cardZ = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['💾 Data Lokal']),
    h('div', { class: 'sub' }, ['Salinan data disimpan di browser ini agar aplikasi tetap jalan saat offline.']),
    h('button', { class: 'btn danger', onclick: () => confirmModal('Reset data lokal?',
      'Data lokal dikembalikan ke contoh awal. Antrian sinkron ikut dibersihkan. Data di spreadsheet TIDAK terpengaruh.',
      () => { demo.reset(); api.clearQueue(); state.cart = {}; toast('Data lokal direset.'); bootLoad(); }, 'Reset', true) }, ['♻️ Reset Data Lokal']),
  ]);
  c.appendChild(cardZ);
}
