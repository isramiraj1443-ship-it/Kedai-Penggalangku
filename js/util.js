/* ============================================================
   util.js — helper umum (format, DOM, waktu)
   ============================================================ */

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_PENDEK = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const PALETTE = ['#0e9f6e','#0284c7','#d97706','#7c3aed','#e02424','#0891b2','#c026d3','#65a30d','#f59e0b','#475569'];

const fmtIDR = n => {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toLocaleString('id-ID');
  return (neg ? '−Rp ' : 'Rp ') + s;
};
const fmtNum  = n => (n === null || n === undefined || isNaN(n)) ? '0' : Math.round(n).toLocaleString('id-ID');
const fmtPct  = (n, d = 1) => (n === null || n === undefined || isNaN(n)) ? '0%' : n.toLocaleString('id-ID', {maximumFractionDigits: d}) + '%';
const fmtQty  = n => fmtNum(n) + ' pcs';
const pad2    = n => String(n).padStart(2, '0');
const ymd     = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const fmtDate = s => {
  if (!s) return '-';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
};
const fmtDateTime = s => {
  if (!s) return '-';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return fmtDate(s) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* DOM kecil: h('div', {class:'x', onclick:fn}, [child, 'text']) */
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'disabled') el.disabled = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

function debounce(fn, ms = 250) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* PRNG deterministik untuk data demo */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function downloadCSV(filename, headers, rows) {
  const escC = v => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(escC).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* toast */
function toast(msg, type = 'ok', ms = 3200) {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const t = h('div', { class: 'toast ' + (type === 'ok' ? 'ok' : type === 'err' ? 'err' : '') },
    [h('span', {}, [type === 'err' ? '⚠️' : '✅']), h('span', {}, [msg])]);
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 320); }, ms);
}

/* modal */
function openModal(node) {
  const root = document.getElementById('modalRoot');
  const back = h('div', { class: 'modal-back', onclick: e => { if (e.target === back) closeModal(); } }, [node]);
  root.innerHTML = '';
  root.appendChild(back);
  return back;
}
function closeModal() { const r = document.getElementById('modalRoot'); if (r) r.innerHTML = ''; }

function confirmModal(title, msg, onYes, yesLabel = 'Ya, lanjutkan', danger = false) {
  openModal(
    h('div', { class: 'modal' }, [
      h('h3', {}, [title]),
      h('p', { style: 'color:var(--ink-2);font-size:13px' }, [msg]),
      h('div', { class: 'm-actions' }, [
        h('button', { class: 'btn', onclick: () => closeModal() }, ['Batal']),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { closeModal(); onYes(); } }, [yesLabel]),
      ]),
    ])
  );
}
