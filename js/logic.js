/* ============================================================
   logic.js — inti perhitungan bisnis Kedai Penggalangku
   (rumus identik dengan Code.gs di sisi Apps Script)
   ============================================================ */

const SETTINGS_DEFAULT = {
  namaKedai: 'Kedai Penggalangku',
  pembulatan: 500,      // pembulatan harga jual ke atas (Rp)
  potKasPct: 1,         // potongan kas = 1% x harga beli satuan
  potUpahPct: 1.5,      // dasar potongan upah = 1.5%
  potUpahMult: 3,       // potongan upah = 3 x (1.5% x harga beli satuan) = 4.5%
};

/* Hitung komponen harga dari sebuah belanja barang */
function hitungHarga(jumlah, hargaBeliTotal, s) {
  jumlah = Math.max(1, Number(jumlah) || 1);
  const hbs     = hargaBeliTotal / jumlah;
  const potKas  = (s.potKasPct / 100) * hbs;
  const potUpah = s.potUpahMult * ((s.potUpahPct / 100) * hbs);
  const basis   = hbs + potKas + potUpah;
  const inc     = Math.max(1, Number(s.pembulatan) || 500);
  const hjsBulat = Math.ceil(basis / inc) * inc;
  return { hbs, potKas, potUpah, hjsBulat };
}

function parseTgl(s) {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

/* Peta stok per Barang_Id: {dibeli, terjual, sisa} */
function stockMap(db) {
  const map = {};
  db.master.forEach(m => {
    map[m.id] = map[m.id] || { dibeli: 0, terjual: 0 };
    map[m.id].dibeli += Number(m.jumlah) || 0;
  });
  db.transactions.forEach(t => {
    map[t.barangId] = map[t.barangId] || { dibeli: 0, terjual: 0 };
    map[t.barangId].terjual += Number(t.qty) || 0;
  });
  Object.values(map).forEach(v => v.sisa = v.dibeli - v.terjual);
  return map;
}

function itemById(db, id) { return db.master.find(m => m.id === id) || null; }

const monthKey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1);

/* ---------- Laporan bulanan (per Barang_Id) ---------- */
function laporanBulan(db, tahun, bulan0) { // bulan0: 0-11
  const akhirBulan = new Date(tahun, bulan0 + 1, 0, 23, 59, 59);
  const rows = [];
  db.master.forEach(m => {
    const tglBeli = parseTgl(m.tanggal);
    if (!tglBeli || tglBeli > akhirBulan) return; // belum ada stok di bulan ini
    let terjualBulan = 0, omzet = 0, potKas = 0, potUpah = 0, terjualSampai = 0;
    db.transactions.forEach(t => {
      if (t.barangId !== m.id) return;
      const d = parseTgl(t.waktu); if (!d) return;
      if (d > akhirBulan) return;
      terjualSampai += t.qty;
      if (d.getMonth() === bulan0 && d.getFullYear() === tahun) {
        terjualBulan += t.qty;
        omzet += t.subtotal;
        potKas += t.potKas;
        potUpah += t.potUpah;
      }
    });
    if (terjualBulan === 0 && (potKas || potUpah) === 0) {
      // tetap tampilkan barang yang sudah distok walau belum laku di bulan itu
    }
    rows.push({
      id: m.id, kategori: m.kategori, nama: m.nama,
      stok: m.jumlah, terjual: terjualBulan, omzet,
      sisa: m.jumlah - terjualSampai,
      potKas, potUpah,
      createdAt: m.createdAt,
    });
  });
  rows.sort((a, b) => b.omzet - a.omzet || b.terjual - a.terjual);
  return rows;
}

/* Bulan-bulan yang punya aktivitas (transaksi atau pengeluaran), terurut naik */
function bulanAktif(db) {
  const set = new Set();
  db.transactions.forEach(t => { const d = parseTgl(t.waktu); if (d) set.add(monthKey(d)); });
  db.expenses.forEach(x => { const d = parseTgl(x.tanggal); if (d) set.add(monthKey(d)); });
  return [...set].sort();
}

/* ---------- Sheet Profit: baris per (bulan x barang) ---------- */
function profitRows(db) {
  const rows = [];
  bulanAktif(db).forEach(key => {
    const [y, m] = key.split('-').map(Number);
    const bulan0 = m - 1;
    const akhirBulan = new Date(y, m, 0, 23, 59, 59);
    const perItem = {};
    db.transactions.forEach(t => {
      const d = parseTgl(t.waktu);
      if (!d || d.getMonth() !== bulan0 || d.getFullYear() !== y) return;
      perItem[t.barangId] = perItem[t.barangId] || { qty: 0 };
      perItem[t.barangId].qty += t.qty;
    });
    Object.entries(perItem).forEach(([id, v]) => {
      const it = itemById(db, id);
      const nama = it ? it.nama : '(barang terhapus)';
      const marginSat = it ? it.margin : 0;
      let terjualSampai = 0;
      db.transactions.forEach(t => {
        if (t.barangId !== id) return;
        const d = parseTgl(t.waktu);
        if (d && d <= akhirBulan) terjualSampai += t.qty;
      });
      const dibeli = it ? it.jumlah : 0;
      rows.push({
        tahun: y, bulan0, bulan: BULAN[bulan0], id, nama,
        terjual: v.qty, sisa: dibeli - terjualSampai,
        marginSat, totalMargin: v.qty * marginSat,
      });
    });
  });
  return rows;
}

/* ---------- Ringkasan per bulan (omzet s/d % laba) ---------- */
function ringkasanBulanan(db) {
  return bulanAktif(db).map(key => {
    const [y, m] = key.split('-').map(Number);
    const bulan0 = m - 1;
    let omzet = 0, hpp = 0, potKas = 0, potUpah = 0;
    db.transactions.forEach(t => {
      const d = parseTgl(t.waktu);
      if (!d || d.getMonth() !== bulan0 || d.getFullYear() !== y) return;
      omzet += t.subtotal;
      hpp += t.qty * (t.hbs || 0);
      potKas += t.potKas;
      potUpah += t.potUpah;
    });
    let pengeluaran = 0;
    db.expenses.forEach(x => {
      const d = parseTgl(x.tanggal);
      if (d && d.getMonth() === bulan0 && d.getFullYear() === y) pengeluaran += Number(x.jumlah) || 0;
    });
    const margin = omzet - hpp;
    const laba = margin - potKas - potUpah - pengeluaran;
    return {
      key, tahun: y, bulan0, bulan: BULAN[bulan0],
      omzet, hpp, margin, potKas, potUpah, pengeluaran,
      laba, pct: omzet > 0 ? (laba / omzet) * 100 : (laba < 0 ? -100 : 0),
    };
  });
}

/* ---------- Agregat dashboard / kesimpulan ---------- */
function dashboardData(db) {
  const ring = ringkasanBulanan(db);
  const stok = stockMap(db);
  const T = { omzet: 0, hpp: 0, margin: 0, potKas: 0, potUpah: 0, pengeluaran: 0, laba: 0, qty: 0 };
  ring.forEach(r => {
    T.omzet += r.omzet; T.hpp += r.hpp; T.margin += r.margin;
    T.potKas += r.potKas; T.potUpah += r.potUpah; T.pengeluaran += r.pengeluaran; T.laba += r.laba;
  });
  db.transactions.forEach(t => T.qty += t.qty);

  // ranking per Barang_Id
  const rank = db.master.map(m => {
    const s = stok[m.id] || { terjual: 0, sisa: 0 };
    let omzet = 0;
    db.transactions.forEach(t => { if (t.barangId === m.id) omzet += t.subtotal; });
    return { id: m.id, nama: m.nama, kategori: m.kategori, terjual: s.terjual, sisa: s.sisa, omzet };
  });
  const top    = [...rank].filter(r => r.terjual > 0).sort((a, b) => b.terjual - a.terjual || b.omzet - a.omzet);
  const bottom = [...rank].sort((a, b) => a.terjual - b.terjual || a.omzet - b.omzet);

  // nilai stok tersisa (harga beli)
  let nilaiStok = 0, qtyStok = 0;
  db.master.forEach(m => {
    const s = stok[m.id]; if (!s) return;
    nilaiStok += Math.max(0, s.sisa) * m.hbs;
    qtyStok += Math.max(0, s.sisa);
  });

  // deret % profit per bulan (tahun aktif terbaru; fallback tahun berjalan)
  const years = ring.map(r => r.tahun);
  const tahunAktif = years.length ? Math.max(...years) : new Date().getFullYear();
  const seriPct = Array.from({ length: 12 }, (_, i) => {
    const r = ring.find(x => x.tahun === tahunAktif && x.bulan0 === i);
    return r ? r.pct : null;
  });
  const seriLaba = Array.from({ length: 12 }, (_, i) => {
    const r = ring.find(x => x.tahun === tahunAktif && x.bulan0 === i);
    return r ? r.laba : null;
  });

  return { ring, stok, total: T, top, bottom, nilaiStok, qtyStok, tahunAktif, seriPct, seriLaba };
}

/* Peringkat persentase: untung/rugi per bulan untuk badge */
function pctBadge(pct) {
  if (pct === null || pct === undefined) return h('span', { class: 'pill pill-zero' }, ['-']);
  const cls = pct > 0 ? 'pill-pos' : pct < 0 ? 'pill-neg' : 'pill-zero';
  const ic = pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '';
  return h('span', { class: 'pill ' + cls }, [ic + fmtPct(pct)]);
}
