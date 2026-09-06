/***************************************************************************
 * KEDAI PENGGALANGKU — Google Apps Script (Backend)
 * --------------------------------------------------------------------------
 * Instalasi singkat (detail di README.md):
 *   1. Buka spreadsheet Anda → Ekstensi → Apps Script
 *   2. Tempel file ini ke Code.gs, lalu buat file HTML bernama "index"
 *      dan tempel isi index.html
 *   3. Deploy → New deployment → Web app
 *        Jalankan sebagai: Saya | Yang memiliki akses: Siapa saja
 *
 * Spreadsheet ID terkunci di bawah ini — tidak perlu diubah.
 ***************************************************************************/

const SPREADSHEET_ID = '1MFWVYJyyYcA28L5wUX4-K7LrXfgO6cGMakHF8E0IFQw';
const APP_NAME = 'Kedai Penggalangku';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const SH = {
  MASTER: 'DataMaster',
  TRX: 'TransaksiPenjualan',
  PENGELUARAN: 'Pengeluaran',
  PROFIT: 'Profit',
  RINGKASAN: 'RingkasanBulanan',
  SETTING: 'Setting',
};

const HEADERS = {};
HEADERS[SH.MASTER] = ['Barang_Id', 'Nama Barang', 'Kode Barang', 'Tanggal Belanja', 'Lokasi Beli',
  'Jumlah Barang Dibeli', 'Harga Beli', 'Harga Beli Satuan', 'Harga Jual Satuan Bulat',
  'Potongan Kas', 'Potongan Upah', 'Harga Jual Satuan', 'Margin', 'Created At'];
HEADERS[SH.TRX] = ['No_Transaksi', 'Waktu', 'Barang_Id', 'Nama Barang', 'Kode Barang', 'Qty',
  'Harga Jual Satuan', 'Subtotal', 'Potongan Kas', 'Potongan Upah', 'Harga Beli Satuan', 'Metode Bayar'];
HEADERS[SH.PENGELUARAN] = ['ID', 'Tanggal', 'Kategori', 'Keterangan', 'Jumlah', 'Created At'];
HEADERS[SH.PROFIT] = ['Tahun', 'Nama Bulan', 'Barang_Id', 'Nama Barang', 'Jumlah Stok Terjual',
  'Sisa Stok', 'Margin Satuan', 'Total Margin'];
HEADERS[SH.RINGKASAN] = ['Tahun', 'Bulan', 'Omzet', 'HPP', 'Margin Kotor', 'Jumlah Potongan Kas',
  'Jumlah Potongan Upah', 'Pengeluaran Lain', 'Laba Bersih', 'Persentase (%)'];
HEADERS[SH.SETTING] = ['Kunci', 'Nilai'];

const LAP_HEADERS = ['Tahun', 'Barang_Id', 'Kode Barang', 'Nama Barang', 'Jumlah Stok',
  'Jumlah Terjual', 'Harga Bayar', 'Sisa Stok', 'Jumlah Potongan Kas', 'Jumlah Potongan Upah', 'Created At'];

const SETTINGS_DEFAULT = {
  namaKedai: 'Kedai Penggalangku',
  pembulatan: 500,      // pembulatan harga jual ke atas (Rp)
  potKasPct: 1,         // potongan kas = 1% x harga beli satuan
  potUpahPct: 1.5,      // dasar potongan upah
  potUpahMult: 3,       // potongan upah = 3 x (1.5% x harga beli satuan)
};

/* ========================= HALAMAN WEB + API =========================
   - Tanpa parameter        → menyajikan aplikasi web (index.html)
   - ?action=ping|all       → JSON API untuk frontend eksternal (Vercel)
   - POST {action, ...}     → JSON API mutasi (tambah/edit/hapus)      */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  try {
    if (action === 'ping') {
      var ss = ss_();
      ensureBase_(ss);
      return out_({ ok: true, app: APP_NAME, sheets: ss.getSheets().map(function (s) { return s.getName(); }).join(', ') });
    }
    if (action === 'all') {
      var ss2 = ss_();
      ensureBase_(ss2);
      return out_({ ok: true, db: dumpDb_(ss2) });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fnMap = {
      'purchase.add': purchaseAdd,
      'sale.checkout': saleCheckout,
      'master.update': masterUpdate,
      'master.delete': masterDelete,
      'trx.update': trxUpdate,
      'trx.delete': trxDelete,
      'expense.add': expenseAdd,
      'expense.update': expenseUpdate,
      'expense.delete': expenseDelete,
    };
    var fn = fnMap[body.action];
    if (!fn) return out_({ ok: false, error: 'Aksi tidak dikenal: ' + body.action });
    return out_(fn(body));
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============== API (dipanggil via google.script.run) ============== */

function getInit() {
  var ss = ss_();
  ensureBase_(ss);
  return { ok: true, app: APP_NAME, db: dumpDb_(ss) };
}

function purchaseAdd(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var nama = String(b.nama || '').trim();
    var jumlah = Math.floor(Number(b.jumlah) || 0);
    var hargaBeli = Math.round(Number(b.hargaBeli) || 0);
    if (!nama) throw new Error('Nama barang wajib diisi.');
    if (jumlah <= 0) throw new Error('Jumlah barang harus lebih dari 0.');
    if (hargaBeli <= 0) throw new Error('Harga beli total harus lebih dari 0.');

    var c = hitungHarga_(jumlah, hargaBeli, s);
    var id = nextBarangId_(ss);
    ss.getSheetByName(SH.MASTER).appendRow([
      id, nama, String(b.kategori || 'Atribut Pelengkap'), String(b.tanggal || fmtD_(new Date())),
      String(b.lokasi || '').trim() || '-', jumlah, hargaBeli,
      r2_(c.hbs), r2_(c.hjsBulat), r2_(c.potKas), r2_(c.potUpah), r2_(c.hjsBulat), r2_(c.hjsBulat - c.hbs), nowDT_(),
    ]);
    recomputeAll_(ss, s);
    return { ok: true, row: { id: id }, db: dumpDb_(ss) };
  });
}

function saleCheckout(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var items = b.items || [];
    if (!items.length) throw new Error('Keranjang masih kosong.');
    var master = readMaster_(ss);
    var trx = readTrx_(ss);
    var stok = stockMap_(master, trx);
    var now = new Date();
    var seqHariIni = 1 + trx.filter(function (t) { return String(t.waktu).slice(0, 10) === fmtD_(now); }).length;
    var trxId = 'TRX-' + fmtD_(now).replace(/-/g, '') + '-' + String(seqHariIni).padStart(3, '0');

    var sh = ss.getSheetByName(SH.TRX);
    items.forEach(function (it) {
      var m = null;
      master.forEach(function (x) { if (x.id === it.id) m = x; });
      if (!m) throw new Error('Barang ' + it.id + ' tidak ditemukan.');
      var qty = Math.floor(Number(it.qty) || 0);
      if (qty <= 0) throw new Error('Jumlah tidak valid untuk ' + m.nama + '.');
      var sisa = (stok[it.id] || {}).sisa || 0;
      if (qty > sisa) throw new Error('Stok ' + m.nama + ' tidak cukup (sisa ' + sisa + ').');
      stok[it.id].sisa -= qty;
      sh.appendRow([
        trxId, fmtDT_(now), m.id, m.nama, m.kategori, qty,
        r2_(m.hjs), r2_(m.hjs * qty), r2_(m.potKas * qty), r2_(m.potUpah * qty), r2_(m.hbs),
        String(b.metode || 'Tunai'),
      ]);
    });
    recomputeAll_(ss, s);
    return { ok: true, trxId: trxId, db: dumpDb_(ss) };
  });
}

function masterUpdate(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var sh = ss.getSheetByName(SH.MASTER);
    var values = sh.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < values.length; i++) if (String(values[i][0]) === String(b.id)) { rowIdx = i; break; }
    if (rowIdx === -1) throw new Error('Barang ' + b.id + ' tidak ditemukan.');

    var nama = String(b.nama || '').trim();
    var jumlah = Math.floor(Number(b.jumlah) || 0);
    var hargaBeli = Math.round(Number(b.hargaBeli) || 0);
    if (!nama) throw new Error('Nama barang wajib diisi.');
    if (jumlah <= 0 || hargaBeli <= 0) throw new Error('Jumlah dan harga beli harus lebih dari 0.');
    var terjual = 0;
    readTrx_(ss).forEach(function (t) { if (t.barangId === String(b.id)) terjual += t.qty; });
    if (jumlah < terjual) throw new Error('Jumlah tidak boleh kurang dari yang sudah terjual (' + terjual + ' pcs).');

    var c = hitungHarga_(jumlah, hargaBeli, s);
    var hjs = Math.round(Number(b.hargaJualSatuan) || c.hjsBulat);
    if (hjs <= 0) throw new Error('Harga jual tidak valid.');
    var row = rowIdx + 1;
    sh.getRange(row, 2).setValue(nama);
    sh.getRange(row, 3).setValue(String(b.kategori || 'Atribut Pelengkap'));
    sh.getRange(row, 4).setValue(String(b.tanggal || values[rowIdx][3]));
    sh.getRange(row, 5).setValue(String(b.lokasi || '').trim() || '-');
    sh.getRange(row, 6).setValue(jumlah);
    sh.getRange(row, 7).setValue(hargaBeli);
    sh.getRange(row, 8).setValue(r2_(c.hbs));
    sh.getRange(row, 9).setValue(r2_(c.hjsBulat));
    sh.getRange(row, 10).setValue(r2_(c.potKas));
    sh.getRange(row, 11).setValue(r2_(c.potUpah));
    sh.getRange(row, 12).setValue(hjs);
    sh.getRange(row, 13).setValue(r2_(hjs - c.hbs));
    recomputeAll_(ss, s);
    return { ok: true, db: dumpDb_(ss) };
  });
}

function masterDelete(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var used = readTrx_(ss).some(function (t) { return t.barangId === b.id; });
    if (used) throw new Error('Tidak bisa dihapus: sudah ada transaksi untuk barang ini.');
    var sh = ss.getSheetByName(SH.MASTER);
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(b.id)) {
        sh.deleteRow(i + 1);
        recomputeAll_(ss, s);
        return { ok: true, db: dumpDb_(ss) };
      }
    }
    throw new Error('Barang tidak ditemukan.');
  });
}

function trxUpdate(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var sh = ss.getSheetByName(SH.TRX);
    var values = sh.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(b.trxId) && String(values[i][2]) === String(b.barangId)) { rowIdx = i; break; }
    }
    if (rowIdx === -1) throw new Error('Baris transaksi tidak ditemukan.');
    var qtyBaru = Math.floor(Number(b.qty) || 0);
    if (qtyBaru <= 0) throw new Error('Qty harus lebih dari 0.');
    var item = null;
    var master = readMaster_(ss);
    master.forEach(function (m) { if (m.id === String(b.barangId)) item = m; });
    if (!item) throw new Error('Barang terkait tidak ditemukan.');
    var oldQty = Number(values[rowIdx][5]) || 0;
    var stok = stockMap_(master, readTrx_(ss));
    var tersedia = ((stok[String(b.barangId)] || {}).sisa || 0) + oldQty;
    if (qtyBaru > tersedia) throw new Error('Stok tidak cukup (maksimum ' + tersedia + ' pcs).');
    var harga = Math.round(Number(b.harga) || item.hjs);
    if (harga <= 0) throw new Error('Harga tidak valid.');
    var row = rowIdx + 1;
    sh.getRange(row, 6).setValue(qtyBaru);
    sh.getRange(row, 7).setValue(harga);
    sh.getRange(row, 8).setValue(r2_(harga * qtyBaru));
    sh.getRange(row, 9).setValue(r2_(item.potKas * qtyBaru));
    sh.getRange(row, 10).setValue(r2_(item.potUpah * qtyBaru));
    if (b.metode) sh.getRange(row, 12).setValue(String(b.metode));
    recomputeAll_(ss, s);
    return { ok: true, db: dumpDb_(ss) };
  });
}

function trxDelete(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var sh = ss.getSheetByName(SH.TRX);
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(b.trxId) && String(values[i][2]) === String(b.barangId)) {
        sh.deleteRow(i + 1);
        recomputeAll_(ss, s); // stok otomatis kembali karena dihitung dari transaksi
        return { ok: true, db: dumpDb_(ss) };
      }
    }
    throw new Error('Baris transaksi tidak ditemukan.');
  });
}

function expenseAdd(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var jumlah = Math.round(Number(b.jumlah) || 0);
    if (jumlah <= 0) throw new Error('Jumlah pengeluaran harus lebih dari 0.');
    var id = nextExpenseId_(ss);
    ss.getSheetByName(SH.PENGELUARAN).appendRow([
      id, String(b.tanggal || fmtD_(new Date())), String(b.kategori || 'Lainnya').trim(),
      String(b.keterangan || '').trim() || '-', jumlah, nowDT_(),
    ]);
    recomputeAll_(ss, s);
    return { ok: true, row: { id: id }, db: dumpDb_(ss) };
  });
}

function expenseUpdate(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var jumlah = Math.round(Number(b.jumlah) || 0);
    if (jumlah <= 0) throw new Error('Jumlah pengeluaran harus lebih dari 0.');
    var sh = ss.getSheetByName(SH.PENGELUARAN);
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(b.id)) {
        var row = i + 1;
        sh.getRange(row, 2).setValue(String(b.tanggal || values[i][1]));
        sh.getRange(row, 3).setValue(String(b.kategori || 'Lainnya').trim());
        sh.getRange(row, 4).setValue(String(b.keterangan || '').trim() || '-');
        sh.getRange(row, 5).setValue(jumlah);
        recomputeAll_(ss, s);
        return { ok: true, db: dumpDb_(ss) };
      }
    }
    throw new Error('Pengeluaran tidak ditemukan.');
  });
}

function expenseDelete(b) {
  return withLock_(function () {
    var ss = ss_(); ensureBase_(ss);
    var s = getSettings_(ss);
    var sh = ss.getSheetByName(SH.PENGELUARAN);
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(b.id)) {
        sh.deleteRow(i + 1);
        recomputeAll_(ss, s);
        return { ok: true, db: dumpDb_(ss) };
      }
    }
    throw new Error('Pengeluaran tidak ditemukan.');
  });
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ================= REKOMPUTASI SHEET BULANAN/PROFIT ================= */

function recomputeAll_(ss, s) {
  var master = readMaster_(ss);
  var trx = readTrx_(ss);
  var exp = readExp_(ss);
  var nowStr = nowDT_();

  /* 1) Sheet bulanan Lap-<Bulan> — dibuat otomatis saat ada aktivitas */
  var keys = bulanAktif_(trx, exp);
  keys.forEach(function (key) {
    var parts = key.split('-');
    var tahun = Number(parts[0]), bulan0 = Number(parts[1]) - 1;
    var sh = monthSheet_(ss, bulan0);
    var akhirBulan = new Date(tahun, bulan0 + 1, 0, 23, 59, 59);

    var oldCreated = {};
    var oldVals = sh.getDataRange().getValues();
    for (var i = 1; i < oldVals.length; i++) {
      if (oldVals[i][1]) oldCreated[oldVals[i][0] + '|' + oldVals[i][1]] = String(oldVals[i][10] || '');
    }

    var byItem = {};
    master.forEach(function (m) {
      var d = parseD_(m.tanggal);
      if (!d || d > akhirBulan) return;
      byItem[m.id] = byItem[m.id] || { id: m.id, nama: m.nama, kategori: m.kategori, stok: 0 };
      byItem[m.id].stok += m.jumlah;
    });
    trx.forEach(function (t) {
      var d = parseD_(t.waktu);
      if (!d || d > akhirBulan) return;
      byItem[t.barangId] = byItem[t.barangId] || { id: t.barangId, nama: t.nama, kategori: t.kategori, stok: 0 };
      var it = byItem[t.barangId];
      it.terjualSampai = (it.terjualSampai || 0) + t.qty;
      if (d.getMonth() === bulan0 && d.getFullYear() === tahun) {
        it.terjual = (it.terjual || 0) + t.qty;
        it.omzet = (it.omzet || 0) + t.subtotal;
        it.potKas = (it.potKas || 0) + t.potKas;
        it.potUpah = (it.potUpah || 0) + t.potUpah;
      }
    });

    var rows = Object.keys(byItem).sort().map(function (id) {
      var it = byItem[id];
      return [
        tahun, id, it.kategori, it.nama, it.stok || 0, it.terjual || 0,
        Math.round(it.omzet || 0), (it.stok || 0) - (it.terjualSampai || 0),
        Math.round(it.potKas || 0), Math.round(it.potUpah || 0),
        oldCreated[tahun + '|' + id] || nowStr,
      ];
    });
    writeRows_(sh, rows);
  });

  /* 2) Sheet Profit */
  var profitRows = [];
  keys.forEach(function (key) {
    var parts = key.split('-');
    var tahun = Number(parts[0]), bulan0 = Number(parts[1]) - 1;
    var akhirBulan = new Date(tahun, bulan0 + 1, 0, 23, 59, 59);
    var perItem = {};
    trx.forEach(function (t) {
      var d = parseD_(t.waktu);
      if (!d || d.getMonth() !== bulan0 || d.getFullYear() !== tahun) return;
      perItem[t.barangId] = (perItem[t.barangId] || 0) + t.qty;
    });
    Object.keys(perItem).sort().forEach(function (id) {
      var m = null; master.forEach(function (x) { if (x.id === id) m = x; });
      var nama = m ? m.nama : '(barang terhapus)';
      var marginSat = m ? m.margin : 0;
      var dibeli = m ? m.jumlah : 0;
      var terjualSampai = 0;
      trx.forEach(function (t) {
        if (t.barangId !== id) return;
        var d = parseD_(t.waktu);
        if (d && d <= akhirBulan) terjualSampai += t.qty;
      });
      profitRows.push([tahun, BULAN[bulan0], id, nama, perItem[id], dibeli - terjualSampai, r2_(marginSat), r2_(perItem[id] * marginSat)]);
    });
  });
  writeRows_(ss.getSheetByName(SH.PROFIT), profitRows);

  /* 3) Sheet RingkasanBulanan (dengan % untung/rugi) */
  var ringRows = keys.map(function (key) {
    var parts = key.split('-');
    var tahun = Number(parts[0]), bulan0 = Number(parts[1]) - 1;
    var omzet = 0, hpp = 0, potKas = 0, potUpah = 0, pengeluaran = 0;
    trx.forEach(function (t) {
      var d = parseD_(t.waktu);
      if (!d || d.getMonth() !== bulan0 || d.getFullYear() !== tahun) return;
      omzet += t.subtotal; hpp += t.qty * (t.hbs || 0); potKas += t.potKas; potUpah += t.potUpah;
    });
    exp.forEach(function (x) {
      var d = parseD_(x.tanggal);
      if (d && d.getMonth() === bulan0 && d.getFullYear() === tahun) pengeluaran += x.jumlah;
    });
    var margin = omzet - hpp;
    var laba = margin - potKas - potUpah - pengeluaran;
    var pct = omzet > 0 ? r2_((laba / omzet) * 100) : (laba < 0 ? -100 : 0);
    return [tahun, BULAN[bulan0], Math.round(omzet), Math.round(hpp), Math.round(margin),
      Math.round(potKas), Math.round(potUpah), Math.round(pengeluaran), Math.round(laba), pct];
  });
  writeRows_(ss.getSheetByName(SH.RINGKASAN), ringRows);
}

function writeRows_(sh, rows) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/* ============================ BACA DATA ============================ */

function dumpDb_(ss) {
  return {
    settings: getSettings_(ss),
    master: readMaster_(ss),
    transactions: readTrx_(ss),
    expenses: readExp_(ss),
  };
}

function readMaster_(ss) {
  var v = ss.getSheetByName(SH.MASTER).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({
      id: String(v[i][0]), nama: String(v[i][1]), kategori: String(v[i][2]),
      tanggal: dateStr_(v[i][3]), lokasi: String(v[i][4]),
      jumlah: num_(v[i][5]), hargaBeli: num_(v[i][6]),
      hbs: num_(v[i][7]), hjsBulat: num_(v[i][8]),
      potKas: num_(v[i][9]), potUpah: num_(v[i][10]),
      hjs: num_(v[i][11]), margin: num_(v[i][12]), createdAt: dateStr_(v[i][13], true),
    });
  }
  return out;
}

function readTrx_(ss) {
  var v = ss.getSheetByName(SH.TRX).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({
      trxId: String(v[i][0]), waktu: dateStr_(v[i][1], true), barangId: String(v[i][2]),
      nama: String(v[i][3]), kategori: String(v[i][4]), qty: num_(v[i][5]),
      harga: num_(v[i][6]), subtotal: num_(v[i][7]),
      potKas: num_(v[i][8]), potUpah: num_(v[i][9]), hbs: num_(v[i][10]), metode: String(v[i][11]),
    });
  }
  return out;
}

function readExp_(ss) {
  var v = ss.getSheetByName(SH.PENGELUARAN).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({
      id: String(v[i][0]), tanggal: dateStr_(v[i][1]), kategori: String(v[i][2]),
      keterangan: String(v[i][3]), jumlah: num_(v[i][4]), createdAt: dateStr_(v[i][5], true),
    });
  }
  return out;
}

function getSettings_(ss) {
  var sh = ss.getSheetByName(SH.SETTING);
  var v = sh.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < v.length; i++) if (v[i][0]) map[String(v[i][0])] = v[i][1];
  return {
    namaKedai: String(map.namaKedai || SETTINGS_DEFAULT.namaKedai),
    pembulatan: num_(map.pembulatan) || SETTINGS_DEFAULT.pembulatan,
    potKasPct: map.potKasPct !== undefined ? num_(map.potKasPct) : SETTINGS_DEFAULT.potKasPct,
    potUpahPct: map.potUpahPct !== undefined ? num_(map.potUpahPct) : SETTINGS_DEFAULT.potUpahPct,
    potUpahMult: map.potUpahMult !== undefined ? num_(map.potUpahMult) : SETTINGS_DEFAULT.potUpahMult,
  };
}

/* ============================ UTILITAS ============================ */

function ss_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function ensureBase_(ss) {
  Object.keys(SH).forEach(function (k) {
    var name = SH[k];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(HEADERS[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold').setBackground('#057a55').setFontColor('#ffffff');
      if (name === SH.MASTER) { sh.getRange('D:D').setNumberFormat('@'); sh.getRange('N:N').setNumberFormat('@'); }
      if (name === SH.TRX) { sh.getRange('B:B').setNumberFormat('@'); }
      if (name === SH.PENGELUARAN) { sh.getRange('A:A').setNumberFormat('@'); sh.getRange('B:B').setNumberFormat('@'); sh.getRange('F:F').setNumberFormat('@'); }
    }
  });
  // migrasi otomatis: sheet Pengeluaran lama tanpa kolom ID
  var shE = ss.getSheetByName(SH.PENGELUARAN);
  if (String(shE.getRange(1, 1).getValue()) !== 'ID') {
    shE.insertColumnsBefore(1, 1);
    shE.getRange(1, 1).setValue('ID').setFontWeight('bold').setBackground('#057a55').setFontColor('#ffffff');
    var lrE = shE.getLastRow();
    for (var rE = 2; rE <= lrE; rE++) {
      if (!shE.getRange(rE, 1).getValue()) shE.getRange(rE, 1).setValue('EXP-' + String(rE - 1).padStart(4, '0'));
    }
    shE.getRange('A:A').setNumberFormat('@'); shE.getRange('B:B').setNumberFormat('@'); shE.getRange('F:F').setNumberFormat('@');
  }
  var shS = ss.getSheetByName(SH.SETTING);
  if (shS.getLastRow() < 2) {
    shS.getRange(2, 1, 5, 2).setValues([
      ['namaKedai', SETTINGS_DEFAULT.namaKedai],
      ['pembulatan', SETTINGS_DEFAULT.pembulatan],
      ['potKasPct', SETTINGS_DEFAULT.potKasPct],
      ['potUpahPct', SETTINGS_DEFAULT.potUpahPct],
      ['potUpahMult', SETTINGS_DEFAULT.potUpahMult],
    ]);
  }
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() <= 1 && s1.getLastColumn() <= 1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(s1); } catch (e) {}
  }
}

function monthSheet_(ss, bulan0) {
  var name = 'Lap-' + BULAN[bulan0];
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(LAP_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, LAP_HEADERS.length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    sh.getRange('K:K').setNumberFormat('@');
  }
  return sh;
}

function hitungHarga_(jumlah, hargaBeliTotal, s) {
  jumlah = Math.max(1, jumlah);
  var hbs = hargaBeliTotal / jumlah;
  var potKas = (s.potKasPct / 100) * hbs;
  var potUpah = s.potUpahMult * ((s.potUpahPct / 100) * hbs);
  var basis = hbs + potKas + potUpah;
  var inc = Math.max(1, s.pembulatan || 500);
  var hjsBulat = Math.ceil(basis / inc) * inc;
  return { hbs: hbs, potKas: potKas, potUpah: potUpah, hjsBulat: hjsBulat };
}

function stockMap_(master, trx) {
  var map = {};
  master.forEach(function (m) {
    map[m.id] = map[m.id] || { dibeli: 0, terjual: 0 };
    map[m.id].dibeli += m.jumlah;
  });
  trx.forEach(function (t) {
    map[t.barangId] = map[t.barangId] || { dibeli: 0, terjual: 0 };
    map[t.barangId].terjual += t.qty;
  });
  Object.keys(map).forEach(function (k) { map[k].sisa = map[k].dibeli - map[k].terjual; });
  return map;
}

function bulanAktif_(trx, exp) {
  var set = {};
  trx.forEach(function (t) { var d = parseD_(t.waktu); if (d) set[monthKey_(d)] = 1; });
  exp.forEach(function (x) { var d = parseD_(x.tanggal); if (d) set[monthKey_(d)] = 1; });
  return Object.keys(set).sort();
}

function nextBarangId_(ss) {
  var v = ss.getSheetByName(SH.MASTER).getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < v.length; i++) {
    var n = parseInt(String(v[i][0]).replace(/\D/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return 'BRG-' + String(max + 1).padStart(4, '0');
}

function nextExpenseId_(ss) {
  var v = ss.getSheetByName(SH.PENGELUARAN).getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < v.length; i++) {
    var n = parseInt(String(v[i][0]).replace(/\D/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return 'EXP-' + String(max + 1).padStart(4, '0');
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function num_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function r2_(n) { return Math.round(n * 100) / 100; }
function monthKey_(d) { return d.getFullYear() + '-' + pad2_(d.getMonth() + 1); }

function nowDT_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm:ss'); }
function fmtD_(d) { return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd'); }
function fmtDT_(d) { return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd HH:mm:ss'); }
function tz_() { try { return Session.getScriptTimeZone() || 'Asia/Jakarta'; } catch (e) { return 'Asia/Jakarta'; } }

function parseD_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  var d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function dateStr_(v, withTime) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), withTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  return String(v);
}
