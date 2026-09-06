/* ============================================================
   pages-kasir.js — Point of Sale (kasir realtime)
   ============================================================ */

function renderKasir(c, db) {
  const stok = stockMap(db);

  const layout = h('div', { class: 'kasir-layout' });
  const left = h('div');
  const right = h('div', { class: 'card', style: 'position:sticky;top:88px' });

  /* pencarian + filter kategori */
  const searchInput = h('input', { placeholder: '🔍 Cari nama barang atau kode…', value: state.kasirQ || '' });
  searchInput.addEventListener('input', debounce(e => { state.kasirQ = e.target.value; paintGrid(); }, 180));
  const seg = h('div', { class: 'seg' });
  [['all', 'Semua'], ['Atribut Wajib', 'Wajib'], ['Atribut Pelengkap', 'Pelengkap']].forEach(([val, label]) => {
    const b = h('button', { class: (state.kasirKat || 'all') === val ? 'on' : '' }, [label]);
    b.addEventListener('click', () => {
      state.kasirKat = val;
      [...seg.children].forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      paintGrid();
    });
    seg.appendChild(b);
  });

  left.appendChild(h('div', { class: 'search-bar' }, [searchInput, seg]));
  const gridEl = h('div', { class: 'prod-grid' });
  left.appendChild(gridEl);

  right.appendChild(h('h3', {}, ['🛒 Keranjang']));
  right.appendChild(h('div', { class: 'sub' }, ['Klik barang di sebelah untuk menambahkan.']));
  const cartEl = h('div');
  right.appendChild(cartEl);

  function itemsView() {
    let list = db.master.filter(m => (stok[m.id] || {}).sisa > 0 || (state.cart[m.id] || 0) > 0);
    const q = (state.kasirQ || '').toLowerCase();
    if (q) list = list.filter(m => (m.nama + ' ' + m.id).toLowerCase().includes(q));
    if (state.kasirKat && state.kasirKat !== 'all') list = list.filter(m => m.kategori === state.kasirKat);
    return list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }

  function paintGrid() {
    gridEl.innerHTML = '';
    const list = itemsView();
    if (!list.length) {
      gridEl.appendChild(h('div', { class: 'empty-note', style: 'grid-column:1/-1' }, ['Tidak ada barang yang cocok.']));
      return;
    }
    list.forEach(m => {
      const s = stok[m.id] || { sisa: 0 };
      const inCart = state.cart[m.id] || 0;
      const disabled = s.sisa <= inCart && inCart === 0;
      const chipCls = s.sisa <= 0 ? 'chip stok out' : s.sisa <= 5 ? 'chip stok warn' : 'chip stok';
      const card = h('div', { class: 'prod-card' + (disabled ? ' disabled' : '') }, [
        h('span', { class: 'p-stock ' + chipCls, style: 'position:static' }, [s.sisa <= 0 ? 'Habis' : 'Stok ' + s.sisa]),
        h('div', { class: 'p-name' }, [m.nama]),
        h('div', { style: 'margin-top:5px' }, [h('span', { class: 'chip ' + (m.kategori === 'Atribut Wajib' ? 'wajib' : 'pelengkap') }, [m.kategori.replace('Atribut ', '')])]),
        h('div', { class: 'p-price' }, [fmtIDR(m.hjs)]),
        inCart ? h('div', { style: 'font-size:11px;color:var(--brand-2);font-weight:700;margin-top:3px' }, ['Di keranjang: ' + inCart + ' pcs']) : null,
      ]);
      card.addEventListener('click', () => {
        const cur = state.cart[m.id] || 0;
        if (cur + 1 > s.sisa) { toast('Stok ' + m.nama + ' hanya ' + s.sisa + ' pcs.', 'err'); return; }
        state.cart[m.id] = cur + 1;
        paintGrid(); paintCart();
      });
      gridEl.appendChild(card);
    });
  }

  function cartTotal() {
    let total = 0, n = 0;
    Object.entries(state.cart).forEach(([id, qty]) => {
      const it = db.master.find(m => m.id === id); if (!it) return;
      total += it.hjs * qty; n += qty;
    });
    return { total, n };
  }

  function paintCart() {
    cartEl.innerHTML = '';
    const entries = Object.entries(state.cart).filter(([, q]) => q > 0);
    if (!entries.length) {
      cartEl.appendChild(h('div', { class: 'empty-note' }, ['Keranjang kosong.']));
    }
    entries.forEach(([id, qty]) => {
      const it = db.master.find(m => m.id === id);
      if (!it) { delete state.cart[id]; return; }
      const s = stok[id] || { sisa: 0 };
      cartEl.appendChild(h('div', { class: 'cart-item' }, [
        h('div', { class: 'ci-name' }, [it.nama, h('small', {}, [fmtIDR(it.hjs) + ' / pcs • ' + id])]),
        h('div', { class: 'qty-ctrl' }, [
          h('button', { onclick: () => { if (qty <= 1) delete state.cart[id]; else state.cart[id] = qty - 1; paintGrid(); paintCart(); } }, ['−']),
          h('span', {}, [String(qty)]),
          h('button', { onclick: () => {
            if (qty + 1 > s.sisa) { toast('Stok ' + it.nama + ' hanya ' + s.sisa + ' pcs.', 'err'); return; }
            state.cart[id] = qty + 1; paintGrid(); paintCart();
          } }, ['+']),
        ]),
        h('b', { style: 'min-width:74px;text-align:right;font-size:12.5px' }, [fmtIDR(it.hjs * qty)]),
        h('button', { class: 'btn sm ghost', title: 'Hapus', onclick: () => { delete state.cart[id]; paintGrid(); paintCart(); } }, ['✕']),
      ]));
    });

    const { total, n } = cartTotal();
    cartEl.appendChild(h('div', { class: 'cart-total' }, [
      h('div', {}, [h('div', { style: 'font-size:11px;color:var(--ink-3);font-weight:700' }, ['TOTAL (' + n + ' pcs)']), ]),
      h('div', { class: 'big' }, [fmtIDR(total)]),
    ]));

    const paySeg = h('div', { class: 'pay-seg' });
    ['Tunai', 'QRIS', 'Transfer'].forEach(mtd => {
      const b = h('button', { class: state.payMethod === mtd ? 'on' : '' }, [mtd === 'Tunai' ? '💵 Tunai' : mtd === 'QRIS' ? '📱 QRIS' : '🏦 Transfer']);
      b.addEventListener('click', () => {
        state.payMethod = mtd;
        [...paySeg.children].forEach(x => x.classList.remove('on'));
        b.classList.add('on');
      });
      paySeg.appendChild(b);
    });
    cartEl.appendChild(paySeg);

    const btnPay = h('button', { class: 'btn primary', style: 'width:100%;padding:13px', disabled: !n }, ['💳 Bayar Sekarang — ' + fmtIDR(total)]);
    btnPay.addEventListener('click', () => doCheckout());
    cartEl.appendChild(btnPay);
  }

  async function doCheckout() {
    const items = Object.entries(state.cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    if (!items.length) return;
    const { total } = cartTotal();
    confirmModal('Konfirmasi Penjualan',
      items.length + ' jenis barang, total ' + fmtIDR(total) + ' — bayar via ' + state.payMethod + '?',
      async () => {
        try {
          const btn = document.getElementById('btnRefresh');
          const res = await api.post('sale.checkout', { items, metode: state.payMethod });
          state.db = res.db;
          state.cart = {};
          openModal(h('div', { class: 'modal' }, [
            h('h3', {}, ['✅ Penjualan Berhasil']),
            h('div', { style: 'background:#f8fafc;border-radius:12px;padding:14px;margin-top:6px' }, [
              h('div', { class: 'receipt-line' }, [h('span', {}, ['No. Transaksi']), h('b', {}, [res.extra.trxId || '-'])]),
              h('div', { class: 'receipt-line' }, [h('span', {}, ['Metode']), h('b', {}, [state.payMethod])]),
              h('div', { class: 'receipt-line total' }, [h('span', {}, ['Total']), h('span', {}, [fmtIDR(total)])]),
              h('div', { class: 'hint', style: 'margin-top:8px' }, ['Saat online: sheet laporan bulan ' + BULAN[new Date().getMonth()] + ' langsung diperbarui di spreadsheet. Saat offline: transaksi masuk antrian sinkron.']),
            ]),
            h('div', { class: 'm-actions' }, [h('button', { class: 'btn primary', onclick: () => closeModal() }, ['Selesai'])]),
          ]));
          paintGrid(); paintCart();
          renderNav(); // badge mode tetap; cukup refresh tampilan lain saat pindah halaman
        } catch (e) {
          toast(e.message || 'Transaksi gagal.', 'err');
        }
      }, 'Ya, proses pembayaran');
  }

  paintGrid(); paintCart();
  layout.append(left, right);
  c.appendChild(layout);
}
