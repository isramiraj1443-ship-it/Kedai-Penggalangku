/* ============================================================
   pages-data.js — Belanja (tambah), Master Data (edit/hapus),
   Transaksi (edit/hapus), Pengeluaran (tambah/edit/hapus)
   ============================================================ */

function fieldBox(labelText, inputEl) {
  return h('div', { class: 'field' }, [h('label', {}, [labelText]), inputEl]);
}

/* ---------------- BELANJA / STOK MASUK (TAMBAH) ---------------- */
function renderBelanja(c, db) {
  const s = db.settings;
  const card = h('div', { class: 'card' }, [
    h('h3', {}, ['📦 Catat Belanja Barang (Tambah)']),
    h('div', { class: 'sub' }, ['Isi data sederhana di bawah — harga satuan, potongan, dan harga jual dihitung otomatis.']),
  ]);

  const fNama = h('input', { placeholder: 'cth: Hasduk / Scarf Merah Putih' });
  const fKat = h('select', {}, [
    h('option', { value: 'Atribut Wajib' }, ['Atribut Wajib']),
    h('option', { value: 'Atribut Pelengkap' }, ['Atribut Pelengkap']),
  ]);
  const fTgl = h('input', { type: 'date', value: ymd(new Date()) });
  const fLokasi = h('input', { placeholder: 'cth: Pasar Klewer' });
  const fJumlah = h('input', { type: 'number', min: 1, placeholder: '0' });
  const fTotal = h('input', { type: 'number', min: 0, placeholder: '0' });

  const prevBox = h('div', { style: 'background:#f8fafc;border:1.5px dashed var(--line);border-radius:12px;padding:14px;margin-top:4px' });

  function preview() {
    const jumlah = Number(fJumlah.value) || 0;
    const total = Number(fTotal.value) || 0;
    prevBox.innerHTML = '';
    if (jumlah <= 0 || total <= 0) {
      prevBox.appendChild(h('div', { class: 'hint' }, ['Isi jumlah & harga beli total untuk melihat hitungan otomatis.']));
      return;
    }
    const calc = hitungHarga(jumlah, total, s);
    const rows = [
      ['Harga beli satuan', fmtIDR(calc.hbs)],
      ['Potongan Kas (1%)', fmtIDR(calc.potKas) + ' /pcs'],
      ['Potongan Upah (3 × 1,5%)', fmtIDR(calc.potUpah) + ' /pcs'],
      ['Harga jual satuan (dibulatkan ↑ kelipatan ' + fmtNum(s.pembulatan) + ')', h('b', { style: 'color:var(--brand-2)' }, [fmtIDR(calc.hjsBulat)])],
      ['Margin / pcs', fmtIDR(calc.hjsBulat - calc.hbs)],
    ];
    rows.forEach(([l, v]) => prevBox.appendChild(h('div', { class: 'receipt-line' }, [h('span', {}, [l]), typeof v === 'string' ? h('b', {}, [v]) : v])));
  }
  fJumlah.addEventListener('input', preview);
  fTotal.addEventListener('input', preview);
  preview();

  card.appendChild(h('div', { class: 'form-grid' }, [
    fieldBox('Nama Barang *', fNama),
    fieldBox('Kode Barang (Kategori)', fKat),
    fieldBox('Tanggal Belanja', fTgl),
    fieldBox('Lokasi Beli', fLokasi),
    fieldBox('Jumlah Barang Dibeli (pcs) *', fJumlah),
    fieldBox('Harga Beli Total (Rp) *', fTotal),
  ]));
  card.appendChild(prevBox);

  const btn = h('button', { class: 'btn primary', style: 'margin-top:14px' }, ['💾 Simpan ke Data Master']);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await api.post('purchase.add', {
        nama: fNama.value, kategori: fKat.value, tanggal: fTgl.value,
        lokasi: fLokasi.value, jumlah: fJumlah.value, hargaBeli: fTotal.value,
      });
      state.db = res.db;
      toast('Barang ' + res.extra.row.id + ' tersimpan di Data Master.');
      navigate('master');
    } catch (e) { toast(e.message || 'Gagal menyimpan.', 'err'); }
    btn.disabled = false;
  });
  card.appendChild(btn);
  c.appendChild(card);

  /* riwayat belanja singkat */
  const hist = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['🧺 Riwayat Belanja Terakhir']),
    h('div', { class: 'sub' }, ['10 catatan terakhir dari sheet DataMaster. Kelola lewat Master Data (edit/hapus tersedia di sana).']),
  ]);
  const wrap = h('div', { class: 'tbl-wrap' });
  const tbl = h('table', { class: 'tbl' });
  tbl.appendChild(h('thead', {}, [h('tr', {}, [
    h('th', {}, ['ID']), h('th', {}, ['Nama']), h('th', {}, ['Tanggal']), h('th', {}, ['Lokasi']),
    h('th', { class: 'num' }, ['Jumlah']), h('th', { class: 'num' }, ['Harga Beli Satuan']), h('th', { class: 'num' }, ['Harga Jual']),
  ])]));
  const tb = h('tbody');
  [...db.master].reverse().slice(0, 10).forEach(m => {
    tb.appendChild(h('tr', {}, [
      h('td', {}, [m.id]), h('td', {}, [m.nama]), h('td', {}, [fmtDate(m.tanggal)]), h('td', {}, [m.lokasi]),
      h('td', { class: 'num' }, [fmtNum(m.jumlah)]), h('td', { class: 'num' }, [fmtIDR(m.hbs)]), h('td', { class: 'num' }, [h('b', {}, [fmtIDR(m.hjs)])]),
    ]));
  });
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  hist.appendChild(wrap);
  c.appendChild(hist);
}

/* ---------------- MASTER DATA (EDIT + HAPUS) ---------------- */
function openMasterEdit(m, s) {
  const fNama = h('input', { value: m.nama });
  const fKat = h('select', {}, [
    h('option', { value: 'Atribut Wajib', selected: m.kategori === 'Atribut Wajib' }, ['Atribut Wajib']),
    h('option', { value: 'Atribut Pelengkap', selected: m.kategori !== 'Atribut Wajib' }, ['Atribut Pelengkap']),
  ]);
  const fTgl = h('input', { type: 'date', value: String(m.tanggal || '').slice(0, 10) });
  const fLokasi = h('input', { value: m.lokasi });
  const fJumlah = h('input', { type: 'number', min: 1, value: m.jumlah });
  const fBeli = h('input', { type: 'number', min: 1, value: Math.round(m.hargaBeli) });
  const fJual = h('input', { type: 'number', min: 1, value: Math.round(m.hjs) });
  const prev = h('div', { style: 'background:#f8fafc;border-radius:10px;padding:11px;margin-top:4px;font-size:12.5px' });

  function paint() {
    prev.innerHTML = '';
    const jumlah = Number(fJumlah.value) || 0;
    const total = Number(fBeli.value) || 0;
    if (jumlah <= 0 || total <= 0) { prev.appendChild(h('span', { class: 'hint' }, ['Lengkapi jumlah & harga beli.'])); return; }
    const calc = hitungHarga(jumlah, total, s);
    const jual = Number(fJual.value) || 0;
    prev.append(
      'HBS ' + fmtIDR(calc.hbs) + ' • Pot. kas ' + fmtIDR(calc.potKas) + ' • Pot. upah ' + fmtIDR(calc.potUpah) +
      ' • Jual bulat ' + fmtIDR(calc.hjsBulat) + ' • Margin ' + fmtIDR(jual - calc.hbs)
    );
  }
  [fJumlah, fBeli, fJual].forEach(el => el.addEventListener('input', paint));
  paint();

  const btnAuto = h('button', { class: 'btn sm', type: 'button' }, ['✨ Pakai harga otomatis']);
  btnAuto.addEventListener('click', () => {
    const calc = hitungHarga(Number(fJumlah.value) || 1, Number(fBeli.value) || 0, s);
    fJual.value = Math.round(calc.hjsBulat);
    paint();
  });

  const btnSave = h('button', { class: 'btn primary' }, ['💾 Simpan Perubahan']);
  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    try {
      const res = await api.post('master.update', {
        id: m.id, nama: fNama.value, kategori: fKat.value, tanggal: fTgl.value, lokasi: fLokasi.value,
        jumlah: fJumlah.value, hargaBeli: fBeli.value, hargaJualSatuan: fJual.value,
      });
      state.db = res.db;
      toast('Barang ' + m.id + ' diperbarui, laporan dihitung ulang.');
      closeModal(); refreshPage();
    } catch (e) { toast(e.message || 'Gagal memperbarui.', 'err'); }
    btnSave.disabled = false;
  });

  openModal(h('div', { class: 'modal' }, [
    h('h3', {}, ['✏️ Edit Barang — ' + m.id]),
    h('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr' }, [
      fieldBox('Nama Barang', fNama),
      fieldBox('Kode Barang (Kategori)', fKat),
      fieldBox('Tanggal Belanja', fTgl),
      fieldBox('Lokasi Beli', fLokasi),
      fieldBox('Jumlah Dibeli (pcs)', fJumlah),
      fieldBox('Harga Beli Total (Rp)', fBeli),
    ]),
    h('div', { class: 'field' }, [h('label', {}, ['Harga Jual Satuan (Rp)']), fJual]),
    h('div', { class: 'form-row' }, [btnAuto, h('span', { class: 'hint' }, ['Potongan & margin dihitung ulang otomatis.'])]),
    prev,
    h('div', { class: 'm-actions' }, [
      h('button', { class: 'btn', onclick: () => closeModal() }, ['Batal']), btnSave,
    ]),
  ]));
}

function renderMaster(c, db) {
  const stok = stockMap(db);
  const card = h('div', { class: 'card' }, [
    h('h3', {}, ['🗂️ Data Master Barang']),
    h('div', { class: 'sub' }, ['Sheet DataMaster — gunakan ✏️ untuk mengubah seluruh data barang, 🗑 untuk menghapus (diproteksi bila sudah ada transaksi).']),
  ]);

  const q = h('input', { placeholder: '🔍 Cari barang…', style: 'max-width:280px;border:1.5px solid var(--line);border-radius:10px;padding:9px 13px;outline:none' });
  q.addEventListener('input', debounce(() => paint(), 180));
  card.appendChild(h('div', { style: 'margin-bottom:12px' }, [q]));

  const wrap = h('div', { class: 'tbl-wrap' });
  card.appendChild(wrap);

  function paint() {
    wrap.innerHTML = '';
    const tbl = h('table', { class: 'tbl' });
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', {}, ['Barang_Id']), h('th', {}, ['Nama Barang']), h('th', {}, ['Kode Barang']), h('th', {}, ['Tgl Belanja']),
      h('th', {}, ['Lokasi']), h('th', { class: 'num' }, ['Jml Beli']), h('th', { class: 'num' }, ['Terjual']),
      h('th', { class: 'num' }, ['Hrg Beli Satuan']), h('th', { class: 'num' }, ['Harga Jual']), h('th', { class: 'num' }, ['Margin']),
      h('th', { class: 'num' }, ['Stok']), h('th', {}, ['Aksi']),
    ])]));
    const tb = h('tbody');
    const filter = (q.value || '').toLowerCase();
    db.master.filter(m => !filter || (m.id + m.nama).toLowerCase().includes(filter)).forEach(m => {
      const st = stok[m.id] || { sisa: 0, terjual: 0 };
      const btnE = h('button', { class: 'btn sm', title: 'Edit barang' }, ['✏️ Edit']);
      btnE.addEventListener('click', () => openMasterEdit(m, db.settings));
      const btnD = h('button', { class: 'btn sm ghost', title: 'Hapus barang' }, ['🗑']);
      btnD.addEventListener('click', () => confirmModal('Hapus barang?',
        m.nama + ' (' + m.id + ') akan dihapus dari Data Master. Barang yang sudah memiliki transaksi tidak dapat dihapus demi menjaga laporan.',
        async () => {
          try {
            const res = await api.post('master.delete', { id: m.id });
            state.db = res.db; toast('Barang dihapus.'); refreshPage();
          } catch (e) { toast(e.message || 'Gagal menghapus.', 'err'); }
        }, 'Hapus', true));

      tb.appendChild(h('tr', {}, [
        h('td', {}, [h('b', {}, [m.id])]),
        h('td', {}, [m.nama]),
        h('td', {}, [h('span', { class: 'chip ' + (m.kategori === 'Atribut Wajib' ? 'wajib' : 'pelengkap') }, [m.kategori.replace('Atribut ', '')])]),
        h('td', {}, [fmtDate(m.tanggal)]),
        h('td', {}, [m.lokasi]),
        h('td', { class: 'num' }, [fmtNum(m.jumlah)]),
        h('td', { class: 'num' }, [fmtNum(st.terjual)]),
        h('td', { class: 'num' }, [fmtIDR(m.hbs)]),
        h('td', { class: 'num' }, [h('b', {}, [fmtIDR(m.hjs)])]),
        h('td', { class: 'num' }, [fmtIDR(m.margin)]),
        h('td', { class: 'num' }, [h('span', { class: 'chip ' + (st.sisa <= 0 ? 'stok out' : st.sisa <= 5 ? 'stok warn' : 'stok') }, [String(st.sisa)])]),
        h('td', {}, [h('div', { style: 'display:flex;gap:6px' }, [btnE, btnD])]),
      ]));
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    if (!db.master.filter(m => !filter || (m.id + m.nama).toLowerCase().includes(filter)).length) {
      wrap.innerHTML = '<div class="empty-note">Tidak ada barang yang cocok.</div>';
    }
  }
  paint();
  c.appendChild(card);
}

/* ---------------- RIWAYAT TRANSAKSI (EDIT + HAPUS) ---------------- */
function openTrxEdit(t, db) {
  const item = db.master.find(m => m.id === t.barangId);
  const fQty = h('input', { type: 'number', min: 1, value: t.qty });
  const fHarga = h('input', { type: 'number', min: 1, value: Math.round(t.harga) });
  const fMetode = h('select', {}, ['Tunai', 'QRIS', 'Transfer'].map(mm =>
    h('option', { value: mm, selected: mm === t.metode }, [mm])));

  const btnSave = h('button', { class: 'btn primary' }, ['💾 Simpan']);
  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    try {
      const res = await api.post('trx.update', {
        trxId: t.trxId, barangId: t.barangId,
        qty: fQty.value, harga: fHarga.value, metode: fMetode.value,
      });
      state.db = res.db;
      toast('Transaksi diperbarui, stok & laporan dihitung ulang.');
      closeModal(); refreshPage();
    } catch (e) { toast(e.message || 'Gagal memperbarui.', 'err'); }
    btnSave.disabled = false;
  });

  openModal(h('div', { class: 'modal' }, [
    h('h3', {}, ['✏️ Edit Transaksi']),
    h('div', { style: 'background:#f8fafc;border-radius:10px;padding:11px;font-size:12.5px;margin-bottom:12px' }, [
      h('div', { class: 'receipt-line' }, [h('span', {}, ['No. Transaksi']), h('b', {}, [t.trxId])]),
      h('div', { class: 'receipt-line' }, [h('span', {}, ['Barang']), h('b', {}, [t.nama + ' (' + t.barangId + ')'])]),
      h('div', { class: 'receipt-line' }, [h('span', {}, ['Waktu']), h('b', {}, [fmtDateTime(t.waktu)])]),
    ]),
    h('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr 1fr' }, [
      fieldBox('Qty (pcs)', fQty),
      fieldBox('Harga Satuan (Rp)', fHarga),
      fieldBox('Metode Bayar', fMetode),
    ]),
    item ? h('div', { class: 'hint', style: 'margin-bottom:8px' }, ['Harga normal barang ini: ' + fmtIDR(item.hjs)]) : null,
    h('div', { class: 'm-actions' }, [
      h('button', { class: 'btn', onclick: () => closeModal() }, ['Batal']), btnSave,
    ]),
  ]));
}

function renderTransaksi(c, db) {
  const card = h('div', { class: 'card' }, [
    h('h3', {}, ['🧾 Riwayat Transaksi Penjualan']),
    h('div', { class: 'sub' }, ['Sheet TransaksiPenjualan. Koreksi penjualan salah? Pakai ✏️ edit atau 🗑 hapus — stok, potongan, dan seluruh laporan ikut dihitung ulang otomatis.']),
  ]);
  const sel = h('select', { style: 'border:1.5px solid var(--line);border-radius:10px;padding:9px 12px' });
  const keys = [...new Set(db.transactions.map(t => String(t.waktu).slice(0, 7)))].sort().reverse();
  sel.appendChild(h('option', { value: 'all' }, ['Semua bulan']));
  keys.forEach(k => {
    const [y, m] = k.split('-').map(Number);
    sel.appendChild(h('option', { value: k }, [BULAN[m - 1] + ' ' + y]));
  });
  if (state.trxFilter && keys.includes(state.trxFilter)) sel.value = state.trxFilter;
  sel.addEventListener('change', () => { state.trxFilter = sel.value; paint(); });
  card.appendChild(h('div', { style: 'margin-bottom:12px' }, [sel]));

  const wrap = h('div', { class: 'tbl-wrap' });
  card.appendChild(wrap);

  function paint() {
    wrap.innerHTML = '';
    let rows = [...db.transactions].reverse();
    if (state.trxFilter && state.trxFilter !== 'all') rows = rows.filter(t => String(t.waktu).slice(0, 7) === state.trxFilter);
    if (!rows.length) { wrap.innerHTML = '<div class="empty-note">Belum ada transaksi pada periode ini.</div>'; return; }
    const tbl = h('table', { class: 'tbl' });
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', {}, ['No. Transaksi']), h('th', {}, ['Waktu']), h('th', {}, ['Barang']),
      h('th', { class: 'num' }, ['Qty']), h('th', { class: 'num' }, ['Harga']), h('th', { class: 'num' }, ['Subtotal']),
      h('th', { class: 'num' }, ['Pot. Kas']), h('th', { class: 'num' }, ['Pot. Upah']), h('th', {}, ['Metode']), h('th', {}, ['Aksi']),
    ])]));
    const tb = h('tbody');
    let tQ = 0, tO = 0;
    rows.slice(0, 400).forEach(t => {
      tQ += t.qty; tO += t.subtotal;
      const btnE = h('button', { class: 'btn sm', title: 'Edit transaksi' }, ['✏️']);
      btnE.addEventListener('click', () => openTrxEdit(t, db));
      const btnD = h('button', { class: 'btn sm ghost', title: 'Hapus transaksi' }, ['🗑']);
      btnD.addEventListener('click', () => confirmModal('Hapus transaksi?',
        t.trxId + ' — ' + t.nama + ' (' + t.qty + ' pcs) akan dihapus. Stok barang otomatis kembali dan laporan bulanan dihitung ulang.',
        async () => {
          try {
            const res = await api.post('trx.delete', { trxId: t.trxId, barangId: t.barangId });
            state.db = res.db; toast('Transaksi dihapus, stok kembali.'); refreshPage();
          } catch (e) { toast(e.message || 'Gagal menghapus.', 'err'); }
        }, 'Hapus', true));
      tb.appendChild(h('tr', {}, [
        h('td', {}, [t.trxId]), h('td', {}, [fmtDateTime(t.waktu)]), h('td', {}, [t.nama, h('div', { class: 'hint' }, [t.barangId])]),
        h('td', { class: 'num' }, [fmtNum(t.qty)]), h('td', { class: 'num' }, [fmtIDR(t.harga)]),
        h('td', { class: 'num' }, [h('b', {}, [fmtIDR(t.subtotal)])]),
        h('td', { class: 'num' }, [fmtIDR(t.potKas)]), h('td', { class: 'num' }, [fmtIDR(t.potUpah)]),
        h('td', {}, [t.metode]),
        h('td', {}, [h('div', { style: 'display:flex;gap:5px' }, [btnE, btnD])]),
      ]));
    });
    tbl.appendChild(tb);
    tbl.appendChild(h('tfoot', {}, [h('tr', {}, [
      h('td', {}, ['TOTAL (' + rows.length + ' baris)']), h('td'), h('td'),
      h('td', { class: 'num' }, [fmtNum(tQ)]), h('td'), h('td', { class: 'num' }, [fmtIDR(tO)]),
      h('td'), h('td'), h('td'), h('td'),
    ])]));
    wrap.appendChild(tbl);
  }
  paint();
  c.appendChild(card);
}

/* ---------------- PENGELUARAN (TAMBAH + EDIT + HAPUS) ---------------- */
function openExpenseEdit(x) {
  const fTgl = h('input', { type: 'date', value: String(x.tanggal || '').slice(0, 10) });
  const fKat = h('select', {}, ['Listrik & Air', 'Perlengkapan', 'Promosi', 'Sewa', 'Lainnya'].map(k =>
    h('option', { value: k, selected: k === x.kategori }, [k])));
  const fKet = h('input', { value: x.keterangan });
  const fJml = h('input', { type: 'number', min: 0, value: Math.round(x.jumlah) });

  const btnSave = h('button', { class: 'btn primary' }, ['💾 Simpan']);
  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    try {
      const res = await api.post('expense.update', { id: x.id, tanggal: fTgl.value, kategori: fKat.value, keterangan: fKet.value, jumlah: fJml.value });
      state.db = res.db; toast('Pengeluaran diperbarui.'); closeModal(); refreshPage();
    } catch (e) { toast(e.message || 'Gagal memperbarui.', 'err'); }
    btnSave.disabled = false;
  });

  openModal(h('div', { class: 'modal' }, [
    h('h3', {}, ['✏️ Edit Pengeluaran — ' + x.id]),
    h('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr' }, [
      fieldBox('Tanggal', fTgl),
      fieldBox('Kategori', fKat),
      fieldBox('Keterangan', fKet),
      fieldBox('Jumlah (Rp)', fJml),
    ]),
    h('div', { class: 'm-actions' }, [
      h('button', { class: 'btn', onclick: () => closeModal() }, ['Batal']), btnSave,
    ]),
  ]));
}

function renderPengeluaran(c, db) {
  const card = h('div', { class: 'card' }, [
    h('h3', {}, ['💸 Catat Pengeluaran Lain (Tambah)']),
    h('div', { class: 'sub' }, ['Biaya di luar potongan kas & upah (listrik, promosi, perlengkapan, dsb).']),
  ]);
  const fTgl = h('input', { type: 'date', value: ymd(new Date()) });
  const fKat = h('select', {}, ['Listrik & Air', 'Perlengkapan', 'Promosi', 'Sewa', 'Lainnya'].map(k => h('option', {}, [k])));
  const fKet = h('input', { placeholder: 'cth: Tagihan listrik September' });
  const fJml = h('input', { type: 'number', min: 0, placeholder: '0' });
  card.appendChild(h('div', { class: 'form-grid' }, [
    fieldBox('Tanggal', fTgl),
    fieldBox('Kategori', fKat),
    fieldBox('Keterangan', fKet),
    fieldBox('Jumlah (Rp)', fJml),
  ]));
  const btn = h('button', { class: 'btn primary' }, ['💾 Simpan Pengeluaran']);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await api.post('expense.add', { tanggal: fTgl.value, kategori: fKat.value, keterangan: fKet.value, jumlah: fJml.value });
      state.db = res.db; toast('Pengeluaran ' + (res.extra.row ? res.extra.row.id : '') + ' tercatat.'); refreshPage();
    } catch (e) { toast(e.message || 'Gagal.', 'err'); }
    btn.disabled = false;
  });
  card.appendChild(btn);
  c.appendChild(card);

  const list = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['Daftar Pengeluaran']),
    h('div', { class: 'sub' }, ['Sheet Pengeluaran — ✏️ edit, 🗑 hapus, ringkasan bulanan ikut dihitung ulang.']),
  ]);
  const wrap = h('div', { class: 'tbl-wrap' });
  const tbl = h('table', { class: 'tbl' });
  tbl.appendChild(h('thead', {}, [h('tr', {}, [
    h('th', {}, ['ID']), h('th', {}, ['Tanggal']), h('th', {}, ['Kategori']), h('th', {}, ['Keterangan']),
    h('th', { class: 'num' }, ['Jumlah']), h('th', {}, ['Aksi']),
  ])]));
  const tb = h('tbody');
  let total = 0;
  [...db.expenses].reverse().forEach(x => {
    total += x.jumlah;
    const btnE = h('button', { class: 'btn sm', title: 'Edit' }, ['✏️']);
    btnE.addEventListener('click', () => openExpenseEdit(x));
    const btnD = h('button', { class: 'btn sm ghost', title: 'Hapus' }, ['🗑']);
    btnD.addEventListener('click', () => confirmModal('Hapus pengeluaran?',
      x.keterangan + ' (' + fmtIDR(x.jumlah) + ') akan dihapus.',
      async () => {
        try {
          const res = await api.post('expense.delete', { id: x.id });
          state.db = res.db; toast('Pengeluaran dihapus.'); refreshPage();
        } catch (e) { toast(e.message || 'Gagal menghapus.', 'err'); }
      }, 'Hapus', true));
    tb.appendChild(h('tr', {}, [
      h('td', {}, [x.id || '-']), h('td', {}, [fmtDate(x.tanggal)]), h('td', {}, [x.kategori]), h('td', {}, [x.keterangan]),
      h('td', { class: 'num' }, [h('b', {}, [fmtIDR(x.jumlah)])]),
      h('td', {}, [h('div', { style: 'display:flex;gap:5px' }, [btnE, btnD])]),
    ]));
  });
  tbl.appendChild(tb);
  tbl.appendChild(h('tfoot', {}, [h('tr', {}, [h('td', {}, ['TOTAL']), h('td'), h('td'), h('td'), h('td', { class: 'num' }, [fmtIDR(total)]), h('td')])]));
  wrap.appendChild(tbl);
  list.appendChild(wrap);
  c.appendChild(list);
}
