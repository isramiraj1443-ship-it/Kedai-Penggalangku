/* ============================================================
   pages-dashboard.js — Dashboard & Kesimpulan
   ============================================================ */

function kpiCard(cls, ic, label, value, sub) {
  return h('div', { class: 'card kpi ' + cls }, [
    h('div', { class: 'k-ic' }, [ic]),
    h('div', { class: 'k-label' }, [label]),
    h('div', { class: 'k-value' }, [value]),
    sub ? h('div', { class: 'k-sub' }, [sub]) : null,
  ]);
}

function flowNode(label, value, cls, pctText, showSign) {
  const txt = (showSign && value > 0 ? '+' : showSign && value < 0 ? '−' : '') + fmtIDR(Math.abs(value));
  return h('div', { class: 'flow-node ' + cls }, [
    h('div', { class: 'f-label' }, [label]),
    h('div', { class: 'f-value' }, [txt]),
    h('div', { class: 'f-pct' }, [pctText]),
  ]);
}

function renderDashboard(c, db) {
  const dash = dashboardData(db);
  const T = dash.total;
  const pctOf = v => T.omzet > 0 ? fmtPct((v / T.omzet) * 100) : '0%';

  /* ---- KPI ---- */
  const kpis = h('div', { class: 'grid g4' }, [
    kpiCard('emerald', '💵', 'Total Omzet', fmtIDR(T.omzet), fmtQty(T.qty) + ' terjual • ' + db.transactions.length + ' transaksi'),
    kpiCard(T.laba >= 0 ? 'indigo' : 'rose', T.laba >= 0 ? '📈' : '📉', 'Laba Bersih Keseluruhan', fmtIDR(T.laba),
      T.omzet > 0 ? (T.laba >= 0 ? 'Untung ' : 'Rugi ') + fmtPct(Math.abs((T.laba / T.omzet) * 100)) + ' dari omzet' : '-'),
    kpiCard('amber', '🧾', 'Akumulasi Potongan Kas', fmtIDR(T.potKas), '1% × harga beli satuan (tiap barang terjual)'),
    kpiCard('amber', '👷', 'Akumulasi Potongan Upah', fmtIDR(T.potUpah), '3 × (1,5% × harga beli satuan)'),
    kpiCard('sky', '📦', 'Nilai Stok Tersisa', fmtIDR(dash.nilaiStok), fmtQty(dash.qtyStok) + ' belum terjual'),
    kpiCard('rose', '💸', 'Pengeluaran Lain', fmtIDR(T.pengeluaran), db.expenses.length + ' catatan pengeluaran'),
    kpiCard('emerald', '🏷️', 'Margin Kotor', fmtIDR(T.margin), pctOf(T.margin) + ' dari omzet'),
    kpiCard('indigo', '🗓️', 'Bulan Aktif', String(dash.ring.length), 'sejak ' + (dash.ring.length ? dash.ring[0].bulan + ' ' + dash.ring[0].tahun : '-')),
  ]);
  c.appendChild(kpis);

  /* ---- Flowchart aliran uang (persentase) ---- */
  const flowCard = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['🔀 Flowchart Aliran Keuntungan (persentase dari omzet)']),
    h('div', { class: 'sub' }, ['Dari omzet masuk sampai laba bersih — potongan kas, upah & pengeluaran ikut terlihat.']),
  ]);
  const flow = h('div', { class: 'flow' });
  const steps = [
    { l: 'Omzet Penjualan', v: T.omzet, cls: 'fn-income', pct: '100%', sign: false },
    { l: 'HPP (Harga Beli)', v: -T.hpp, cls: 'fn-cost', pct: pctOf(T.hpp), sign: true },
    { l: 'Margin Kotor', v: T.margin, cls: 'fn-margin', pct: pctOf(T.margin), sign: false },
    { l: 'Potongan Kas', v: -T.potKas, cls: 'fn-cost', pct: pctOf(T.potKas), sign: true },
    { l: 'Potongan Upah', v: -T.potUpah, cls: 'fn-cost', pct: pctOf(T.potUpah), sign: true },
    { l: 'Pengeluaran Lain', v: -T.pengeluaran, cls: 'fn-cost', pct: pctOf(T.pengeluaran), sign: true },
    { l: 'Laba Bersih', v: T.laba, cls: T.laba >= 0 ? 'fn-final' : 'fn-neg-final', pct: pctOf(Math.abs(T.laba)) + (T.laba >= 0 ? ' untung' : ' rugi'), sign: false },
  ];
  steps.forEach((s, i) => {
    if (i > 0) flow.appendChild(h('div', { class: 'flow-arrow' }, ['➜']));
    flow.appendChild(flowNode(s.l, s.v, s.cls, s.pct, s.sign));
  });
  flowCard.appendChild(flow);
  c.appendChild(flowCard);

  /* ---- Kesimpulan otomatis ---- */
  const best = dash.top[0], worst = dash.bottom[0];
  const insights = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['📌 Kesimpulan Otomatis']),
    h('div', { class: 'sub' }, ['Dibaca langsung dari seluruh data transaksi Anda.']),
    best ? h('div', { class: 'insight' }, [
      h('span', { class: 'i-ic' }, ['🏆']),
      h('div', {}, [h('b', {}, ['Barang paling laku: ' + best.nama + ' — ' + fmtQty(best.terjual)]),
        h('div', {}, ['menyumbang omzet ' + fmtIDR(best.omzet) + ' (' + (T.omzet > 0 ? fmtPct((best.omzet / T.omzet) * 100) : '0%') + ' dari total omzet). Pertimbangkan stok ulang lebih awal.'])]),
    ]) : h('div', { class: 'insight' }, [h('span', { class: 'i-ic' }, ['🏆']), h('div', {}, ['Belum ada penjualan.'])]),
    worst ? h('div', { class: 'insight amber-bg' }, [
      h('span', { class: 'i-ic' }, ['🐢']),
      h('div', {}, [h('b', {}, ['Paling minim terjual: ' + worst.nama + ' — ' + fmtQty(worst.terjual)]),
        h('div', {}, ['sisa stok ' + fmtQty(worst.sisa) + (worst.terjual === 0 ? ' (belum pernah terjual). Coba promosi/bundling agar perputaran membaik.' : '.')])]),
    ]) : null,
    h('div', { class: 'insight' }, [
      h('span', { class: 'i-ic' }, ['💰']),
      h('div', {}, [
        h('b', {}, ['Keuntungan penjualan seluruhnya: ' + fmtIDR(T.laba) + (T.omzet > 0 ? ' (' + fmtPct((T.laba / T.omzet) * 100) + ' dari omzet)' : '')]),
        h('div', {}, ['Margin kotor ' + fmtIDR(T.margin) + ' − akumulasi potongan kas ' + fmtIDR(T.potKas) +
          ' − akumulasi potongan upah ' + fmtIDR(T.potUpah) + ' − pengeluaran lain ' + fmtIDR(T.pengeluaran) + '.']),
      ]),
    ]),
  ]);
  c.appendChild(insights);

  /* ---- Grafik ---- */
  const charts = h('div', { class: 'grid g3', style: 'margin-top:16px' });

  const cLine = h('div', { class: 'card' }, [
    h('h3', {}, ['📈 Laba Bersih per Bulan — ' + dash.tahunAktif]),
    h('div', { class: 'sub' }, ['Persentase untung/rugi terhadap omzet tiap bulan.']),
    h('div', { id: 'chartLine' }),
  ]);
  const cTop = h('div', { class: 'card' }, [
    h('h3', {}, ['🏆 Barang Terlaris']),
    h('div', { class: 'sub' }, ['Berdasarkan jumlah pcs terjual.']),
    h('div', { id: 'chartTop' }),
  ]);
  const cDonut = h('div', { class: 'card' }, [
    h('h3', {}, ['🍩 Komposisi Omzet']),
    h('div', { class: 'sub' }, ['Kontribusi tiap barang terhadap omzet.']),
    h('div', { id: 'chartDonut' }),
  ]);
  charts.append(cLine, cTop, cDonut);
  c.appendChild(charts);

  lineChart(cLine.querySelector('#chartLine'), {
    labels: BULAN_PENDEK,
    series: [
      { name: '% Laba', values: dash.seriPct, color: '#0e9f6e', fill: true },
    ],
    yFmt: v => fmtPct(v, 0), zeroLine: true, height: 240,
  });
  barList(cTop.querySelector('#chartTop'),
    dash.top.slice(0, 6).map((t, i) => ({ label: t.nama, value: t.terjual, color: PALETTE[i % PALETTE.length] })),
    { fmt: v => fmtQty(v) });
  const topOmzet = [...dash.top].sort((a, b) => b.omzet - a.omzet).slice(0, 5);
  const lainOmzet = dash.top.slice(5).reduce((a, b) => a + b.omzet, 0) +
    dash.bottom.filter(b => b.omzet > 0).reduce((a, b) => a + b.omzet, 0);
  const donutItems = topOmzet.map((t, i) => ({ label: t.nama, value: t.omzet, color: PALETTE[i % PALETTE.length] }));
  if (lainOmzet > 0) donutItems.push({ label: 'Lainnya', value: lainOmzet, color: '#94a3b8' });
  donut(cDonut.querySelector('#chartDonut'), { items: donutItems, centerTitle: 'Omzet', centerValue: fmtIDR(T.omzet), size: 180 });

  /* ---- Tabel ringkasan bulanan ---- */
  const tblCard = h('div', { class: 'card', style: 'margin-top:16px' }, [
    h('h3', {}, ['🗓️ Ringkasan Bulanan']),
    h('div', { class: 'sub' }, ['Persentase dihitung: (Laba Bersih ÷ Omzet) × 100%. Otomatis tersinkron ke sheet RingkasanBulanan.']),
  ]);
  if (!dash.ring.length) {
    tblCard.appendChild(h('div', { class: 'empty-note' }, ['Belum ada transaksi. Mulai dari halaman Kasir atau Belanja.']));
  } else {
    const wrap = h('div', { class: 'tbl-wrap' });
    const tbl = h('table', { class: 'tbl' });
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', {}, ['Bulan']), h('th', { class: 'num' }, ['Omzet']), h('th', { class: 'num' }, ['HPP']),
      h('th', { class: 'num' }, ['Margin Kotor']), h('th', { class: 'num' }, ['Pot. Kas']), h('th', { class: 'num' }, ['Pot. Upah']),
      h('th', { class: 'num' }, ['Pengeluaran']), h('th', { class: 'num' }, ['Laba Bersih']), h('th', {}, ['% Untung/Rugi']),
    ])]));
    const tb = h('tbody');
    dash.ring.forEach(r => {
      tb.appendChild(h('tr', {}, [
        h('td', {}, [h('b', {}, [r.bulan + ' ' + r.tahun])]),
        h('td', { class: 'num' }, [fmtIDR(r.omzet)]),
        h('td', { class: 'num' }, [fmtIDR(r.hpp)]),
        h('td', { class: 'num' }, [fmtIDR(r.margin)]),
        h('td', { class: 'num' }, [fmtIDR(r.potKas)]),
        h('td', { class: 'num' }, [fmtIDR(r.potUpah)]),
        h('td', { class: 'num' }, [fmtIDR(r.pengeluaran)]),
        h('td', { class: 'num' }, [h('b', {}, [fmtIDR(r.laba)])]),
        h('td', {}, [pctBadge(r.pct)]),
      ]));
    });
    tbl.appendChild(tb);
    tbl.appendChild(h('tfoot', {}, [h('tr', {}, [
      h('td', {}, ['TOTAL']),
      h('td', { class: 'num' }, [fmtIDR(T.omzet)]),
      h('td', { class: 'num' }, [fmtIDR(T.hpp)]),
      h('td', { class: 'num' }, [fmtIDR(T.margin)]),
      h('td', { class: 'num' }, [fmtIDR(T.potKas)]),
      h('td', { class: 'num' }, [fmtIDR(T.potUpah)]),
      h('td', { class: 'num' }, [fmtIDR(T.pengeluaran)]),
      h('td', { class: 'num' }, [fmtIDR(T.laba)]),
      h('td', {}, [pctBadge(T.omzet > 0 ? (T.laba / T.omzet) * 100 : 0)]),
    ])]));
    wrap.appendChild(tbl);
    tblCard.appendChild(wrap);
  }
  c.appendChild(tblCard);
}
