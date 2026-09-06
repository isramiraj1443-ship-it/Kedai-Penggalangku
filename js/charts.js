/* ============================================================
   charts.js — grafik SVG murni (tanpa pustaka eksternal)
   ============================================================ */

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => { if (c) el.appendChild(c); });
  return el;
}

/* ---------- Grafik garis (multi-seri, mendukung null) ----------
   lineChart(container, {
     labels: ['Jan',...],
     series: [{name, values:[num|null], color, fill?}],
     yFmt: v=>...,  height
   }) */
function lineChart(container, { labels, series, yFmt = v => String(Math.round(v)), height = 250, zeroLine = false }) {
  container.innerHTML = '';
  const W = 720, H = height, padL = 52, padR = 16, padT = 18, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;

  const all = series.flatMap(s => s.values).filter(v => v !== null && v !== undefined);
  if (!all.length) {
    container.appendChild(h('div', { class: 'empty-note' }, ['Belum ada data untuk ditampilkan.']));
    return;
  }
  let lo = Math.min(...all, zeroLine ? 0 : Infinity), hi = Math.max(...all, zeroLine ? 0 : -Infinity);
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, pad = span * 0.12;
  lo -= pad; hi += pad;

  const x = i => padL + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * ih;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}` });

  // grid horizontal
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = lo + ((hi - lo) / ticks) * t;
    const yy = y(v);
    svg.appendChild(svgEl('line', { x1: padL, y1: yy, x2: W - padR, y2: yy, stroke: '#eef2f7', 'stroke-width': 1 }));
    svg.appendChild(svgEl('text', { x: padL - 8, y: yy + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: '#94a3b8', text: yFmt(v) }));
  }
  // garis nol bila relevan
  if (lo < 0 && hi > 0) {
    svg.appendChild(svgEl('line', { x1: padL, y1: y(0), x2: W - padR, y2: y(0), stroke: '#cbd5e1', 'stroke-width': 1.2, 'stroke-dasharray': '4 4' }));
  }
  // label sumbu X
  labels.forEach((lb, i) => {
    svg.appendChild(svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#64748b', text: lb }));
  });

  series.forEach(s => {
    // area fill opsional
    if (s.fill) {
      let d = '', started = false, firstX = 0, lastX = 0;
      s.values.forEach((v, i) => {
        if (v === null || v === undefined) return;
        if (!started) { d += `M ${x(i)} ${y(v)}`; firstX = x(i); started = true; }
        else d += ` L ${x(i)} ${y(v)}`;
        lastX = x(i);
      });
      if (started) {
        const y0 = y(Math.max(lo, Math.min(hi, 0)));
        d += ` L ${lastX} ${y0} L ${firstX} ${y0} Z`;
        svg.appendChild(svgEl('path', { d, fill: s.color, opacity: 0.10, stroke: 'none' }));
      }
    }
    // garis per segmen (putus di null)
    let seg = [];
    const flush = () => {
      if (seg.length > 1) {
        svg.appendChild(svgEl('polyline', {
          points: seg.map(p => `${p[0]},${p[1]}`).join(' '),
          fill: 'none', stroke: s.color, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }));
      }
      seg = [];
    };
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) { flush(); return; }
      seg.push([x(i), y(v)]);
    });
    flush();
    // titik
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) return;
      const c = svgEl('circle', { cx: x(i), cy: y(v), r: 3.4, fill: '#fff', stroke: s.color, 'stroke-width': 2.2 });
      c.appendChild(svgEl('title', { text: `${s.name} — ${labels[i]}: ${yFmt(v)}` }));
      svg.appendChild(c);
    });
  });

  const box = h('div', { class: 'chart-box' }, [svg]);
  container.appendChild(box);
  if (series.length > 1 || series[0].name) {
    container.appendChild(h('div', { class: 'legend' },
      series.map(s => h('span', { class: 'lg-item' }, [
        h('span', { class: 'dot', style: `background:${s.color}` }), s.name,
      ]))));
  }
}

/* ---------- Donut chart ----------
   donut(container, {items:[{label,value,color}], centerTitle, centerValue, size}) */
function donut(container, { items, centerTitle = '', centerValue = '', size = 190 }) {
  container.innerHTML = '';
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!total) { container.appendChild(h('div', { class: 'empty-note' }, ['Belum ada data.'])); return; }
  const cx = size / 2, cy = size / 2, r = size / 2 - 6, thick = 26;
  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, style: 'max-width:' + size + 'px;margin:0 auto' });
  let angle = -Math.PI / 2;
  items.forEach(it => {
    const frac = it.value / total;
    const a2 = angle + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + (r - thick / 2) * Math.cos(angle), y1 = cy + (r - thick / 2) * Math.sin(angle);
    const x2 = cx + (r - thick / 2) * Math.cos(a2 - 0.0001), y2 = cy + (r - thick / 2) * Math.sin(a2 - 0.0001);
    if (frac >= 0.9999) {
      svg.appendChild(svgEl('circle', { cx, cy, r: r - thick / 2, fill: 'none', stroke: it.color, 'stroke-width': thick }));
    } else {
      const p = svgEl('path', {
        d: `M ${x1} ${y1} A ${r - thick / 2} ${r - thick / 2} 0 ${large} 1 ${x2} ${y2}`,
        fill: 'none', stroke: it.color, 'stroke-width': thick,
      });
      p.appendChild(svgEl('title', { text: `${it.label}: ${fmtPct(frac * 100)}` }));
      svg.appendChild(p);
    }
    angle = a2;
  });
  svg.appendChild(svgEl('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#64748b', 'font-weight': 700, text: centerTitle }));
  svg.appendChild(svgEl('text', { x: cx, y: cy + 15, 'text-anchor': 'middle', 'font-size': 13.5, fill: '#0f172a', 'font-weight': 800, text: centerValue }));
  const wrap = h('div', { style: 'display:flex;align-items:center;gap:18px;flex-wrap:wrap' }, [svg]);
  wrap.appendChild(h('div', { class: 'legend', style: 'flex:1;min-width:150px;flex-direction:column;align-items:flex-start;gap:6px;display:flex' },
    items.map(it => h('div', { class: 'lg-item', style: 'width:100%;justify-content:space-between;display:flex;gap:8px' }, [
      h('span', {}, [h('span', { class: 'dot', style: `background:${it.color}` }), it.label]),
      h('b', {}, [fmtPct((it.value / total) * 100, 1)]),
    ]))));
  container.appendChild(wrap);
}

/* ---------- Bar horizontal (HTML) ---------- */
function barList(container, rows, { fmt = v => fmtNum(v), color = 'var(--brand)' } = {}) {
  container.innerHTML = '';
  if (!rows.length) { container.appendChild(h('div', { class: 'empty-note' }, ['Belum ada data.'])); return; }
  const max = Math.max(...rows.map(r => r.value), 1);
  rows.forEach(r => {
    container.appendChild(h('div', { style: 'margin-bottom:11px' }, [
      h('div', { style: 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px' }, [
        h('span', { style: 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62%' }, [r.label]),
        h('b', {}, [fmt(r.value)]),
      ]),
      h('div', { style: 'height:9px;background:#eef2f7;border-radius:99px;overflow:hidden' }, [
        h('div', { style: `height:100%;width:${(r.value / max) * 100}%;background:${r.color || color};border-radius:99px;transition:width .5s` }),
      ]),
    ]));
  });
}
