(function () {
  'use strict';
  const { u, tools, byId, cats } = IT;
  const $ = (s, r) => (r || document).querySelector(s);
  const CODE = { network: 'IP', infra: 'OPS', web: 'DNS', security: 'SEC', soc: 'IR', encode: 'ENC', data: 'TXT', time: 'CLK', windows: 'WIN', linux: 'NIX', capacity: 'CAP', helpdesk: 'HLP' };

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'text') n.textContent = v;
      else if (k in n && k !== 'list') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c);
    return n;
  }
  IT.el = el;

  const KEY = 'ittools.v1';
  const store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  store.fav = store.fav || [];
  store.recent = store.recent || [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private window */ } };

  function setTheme(t) {
    store.theme = t;
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    save();
  }
  if (store.theme) document.documentElement.dataset.theme = store.theme;

  // ---------- small shared bits ----------
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 1800);
  }
  IT.toast = toast;
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const a = el('textarea', { value: text, class: 'offscreen' });
      document.body.append(a);
      a.select();
      document.execCommand('copy');
      a.remove();
    }
    toast('Copied');
  }
  IT.copy = copy;
  function save2file(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type: type || 'text/plain' }));
    const a = el('a', { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const copyBtn = (get, label) => el('button', { class: 'mini', type: 'button', text: label || 'Copy', onclick: () => copy(typeof get === 'function' ? get() : get) });

  // ---------- output rendering ----------
  function tableEl(t) {
    return el('div', { class: 'table-wrap', tabIndex: 0 }, el('table', {}, el('thead', {}, el('tr', {}, t.head.map((h) => el('th', { text: h, scope: 'col' })))), el('tbody', {}, t.rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: c === null || c === undefined ? '' : String(c) })))))));
  }
  const tableText = (t) => [t.head, ...t.rows].map((r) => r.join('\t')).join('\n');
  function bitsEl({ value, width, prefix }) {
    const s = value.toString(2).padStart(width, '0');
    const wrap = el('div', { class: 'bits', role: 'img', ariaLabel: `${prefix} network bits, ${width - prefix} host bits` });
    for (let o = 0; o < 4; o++) {
      const g = el('span', { class: 'octet' });
      for (let i = 0; i < 8; i++) { const p = o * 8 + i; g.append(el('i', { class: p < prefix ? 'n' : 'h', text: s[p] })); }
      wrap.append(g);
    }
    return el('div', {}, wrap, el('div', { class: 'bits-key' }, el('span', { class: 'n', text: `${prefix} network bits` }), el('span', { class: 'h', text: `${width - prefix} host bits` })));
  }
  function blockEl(b) {
    if (b === null || b === undefined) return null;
    if (typeof b === 'string') b = { text: b };
    const box = el('section', { class: 'block unit' }, IT.leds());
    if (b.title) {
      const head = el('div', { class: 'block-head' }, el('h3', { text: b.title }));
      box.append(head);
    }
    if (b.big !== undefined) box.append(el('div', { class: 'bigval' + (b.small ? ' small' : ''), text: b.big }), el('div', { class: 'bigbar' }, copyBtn(String(b.big))));
    if (b.bits) box.append(bitsEl(b.bits));
    if (b.meter) {
      const m = b.meter, pct = Math.max(0, Math.min(1, m.value));
      const tone = m.good ? (pct < 0.4 ? 'bad' : pct < 0.65 ? 'warn' : 'ok') : m.value > 1 ? 'bad' : pct > 0.8 ? 'warn' : 'ok';
      const fill = el('i', { class: tone });
      fill.style.width = (pct * 100).toFixed(1) + '%';
      box.append(el('div', { class: 'meter-row' }, el('span', { text: m.label }), el('b', { text: m.text })), el('div', { class: 'meter' }, fill));
    }
    if (b.kv) {
      const dl = el('div', { class: 'kv' });
      for (const [k, v] of b.kv) dl.append(el('div', { class: 'kv-row' }, el('span', { class: 'k', text: k }), el('code', { class: 'v', text: v }), copyBtn(String(v))));
      box.append(dl);
    }
    if (b.diff) {
      box.append(el('pre', { class: 'diff', tabIndex: 0 }, b.diff.map(([s, l]) => el('span', { class: s === '+' ? 'add' : s === '-' ? 'del' : '', text: `${s} ${l}\n` }))));
    }
    if (b.table) {
      box.append(tableEl(b.table));
      const foot = el('div', { class: 'block-foot' }, b.note ? el('span', { text: b.note }) : el('span'), copyBtn(() => tableText(b.table), 'Copy table'));
      box.append(foot);
    } else if (b.note) box.append(el('div', { class: 'note ' + (b.tone || ''), role: 'status', text: b.note }));
    if (b.text !== undefined) {
      box.append(el('pre', { class: 'out', tabIndex: 0, text: b.text }), el('div', { class: 'block-foot' }, el('span', { text: b.text.length > 1000 ? `${u.nf(b.text.length, 0)} characters` : '' }), el('span', { class: 'acts' }, b.name ? el('button', { class: 'mini', type: 'button', text: 'Download', onclick: () => save2file(b.name, b.text) }) : null, copyBtn(b.text))));
    }
    if (b.svg) {
      box.append(el('div', { class: 'svgbox' + (b.wide ? ' wide' : '') }, el('img', { alt: b.title || 'Generated code', src: 'data:image/svg+xml;base64,' + u.b64(u.utf8(b.svg)) })), el('div', { class: 'block-foot' }, el('span'), el('span', { class: 'acts' }, el('button', { class: 'mini', type: 'button', text: 'Download SVG', onclick: () => save2file(b.name || 'image.svg', b.svg, 'image/svg+xml') }), el('button', { class: 'mini', type: 'button', text: 'Print', onclick: () => window.print() }))));
    }
    return box;
  }
  function renderOut(root, out) {
    root.replaceChildren();
    const list = (Array.isArray(out) ? out : [out]).filter((x) => x !== null && x !== undefined);
    list.forEach((b) => { const n = blockEl(b); if (n) root.append(n); });
    return list.length > 0;
  }
  IT.renderOut = renderOut;

  // ---------- form fields ----------
  function fieldEl(f, vals, changed) {
    const id = 'f-' + f.k;
    const set = (v) => { vals[f.k] = v; changed(); };
    const lab = (extra) => el('label', { for: id, class: 'lab', text: f.label + (extra || '') });
    const wrap = el('div', { class: 'field t-' + f.type + (f.half ? ' half' : '') });
    wrap.dataset.key = f.k;
    let sync = () => {};
    const plain = { spellcheck: false, autocomplete: 'off', autocapitalize: 'off' };
    switch (f.type) {
      case 'area': {
        const a = el('textarea', { id, rows: f.rows || 6, placeholder: f.ph || '', class: f.mono === false ? '' : 'mono', ...plain, oninput: (e) => set(e.target.value) });
        sync = () => { a.value = vals[f.k]; };
        wrap.append(lab(), a);
        break;
      }
      case 'num': {
        const a = el('input', { id, type: 'number', min: f.min, max: f.max, step: f.step || 1, oninput: (e) => set(e.target.value === '' ? 0 : +e.target.value) });
        sync = () => { a.value = vals[f.k]; };
        wrap.append(lab(), a);
        break;
      }
      case 'range': {
        const out = el('b', {});
        const a = el('input', { id, type: 'range', min: f.min, max: f.max, oninput: (e) => { out.textContent = e.target.value; set(+e.target.value); } });
        sync = () => { a.value = vals[f.k]; out.textContent = vals[f.k]; };
        wrap.append(el('label', { for: id, class: 'lab' }, f.label + ' ', out), a);
        break;
      }
      case 'select': {
        const a = el('select', { id, onchange: (e) => set(e.target.value) }, f.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return el('option', { value: v, text: l }); }));
        sync = () => { a.value = vals[f.k]; };
        wrap.append(lab(), a);
        break;
      }
      case 'seg': {
        const btns = f.options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          const b = el('button', { type: 'button', text: l, onclick: () => set(v) });
          b.dataset.v = v;
          return b;
        });
        sync = () => btns.forEach((b) => { const on = b.dataset.v === String(vals[f.k]); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        wrap.append(el('div', { class: 'lab', text: f.label }), el('div', { class: 'seg', role: 'group', ariaLabel: f.label }, btns));
        break;
      }
      case 'check': {
        const a = el('input', { id, type: 'checkbox', onchange: (e) => set(e.target.checked) });
        sync = () => { a.checked = !!vals[f.k]; };
        wrap.append(el('label', { for: id, class: 'check' }, a, el('span', { text: f.label })));
        break;
      }
      case 'file': {
        const name = el('span', { text: 'Drop a file here, or click to choose' });
        const load = async (file) => {
          if (!file) return;
          if (file.size > 2 ** 31) return toast('That file is over 2 GB, too large to read in a browser.');
          name.textContent = `${file.name} (${u.fmtBytes(file.size)})`;
          set({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
        };
        const a = el('input', { id, type: 'file', class: 'offscreen', onchange: (e) => load(e.target.files[0]) });
        const zone = el('label', { for: id, class: 'drop', ondragover: (e) => { e.preventDefault(); zone.classList.add('over'); }, ondragleave: () => zone.classList.remove('over'), ondrop: (e) => { e.preventDefault(); zone.classList.remove('over'); load(e.dataTransfer.files[0]); } }, name);
        sync = () => { if (!vals[f.k]) { a.value = ''; name.textContent = 'Drop a file here, or click to choose'; } };
        wrap.append(el('div', { class: 'lab', text: f.label }), a, zone);
        break;
      }
      case 'password': {
        const a = el('input', { id, type: 'password', class: 'mono', autocomplete: 'new-password', spellcheck: false, oninput: (e) => set(e.target.value) });
        const t = el('button', { class: 'mini', type: 'button', text: 'Show', onclick: () => { const s = a.type === 'password'; a.type = s ? 'text' : 'password'; t.textContent = s ? 'Hide' : 'Show'; } });
        sync = () => { a.value = vals[f.k]; };
        wrap.append(lab(), el('div', { class: 'with-btn' }, a, t));
        break;
      }
      case 'color': {
        const a = el('input', { id, type: 'color', oninput: (e) => set(e.target.value) });
        sync = () => { a.value = vals[f.k]; };
        wrap.append(lab(), a);
        break;
      }
      default: {
        const type = f.type === 'datetime' ? 'datetime-local' : f.type === 'date' ? 'date' : 'text';
        const a = el('input', { id, type, placeholder: f.ph || '', class: f.mono ? 'mono' : '', ...plain, oninput: (e) => set(e.target.value) });
        sync = () => { a.value = vals[f.k]; };
        wrap.append(lab(), a);
      }
    }
    return { wrap, sync, f };
  }

  // ---------- pages ----------
  const main = () => $('#main');
  let teardown = null;
  const stop = () => { if (teardown) { teardown(); teardown = null; } };

  let ledSeed = 0;
  function led(kind) {
    const n = el('i', { class: 'led ' + (kind || '') });
    if (kind && kind.includes('act')) {
      ledSeed = (ledSeed * 31 + 17) % 997;
      n.style.animationDelay = `-${(ledSeed % 70) / 10}s`;
      n.style.animationDuration = `${1.6 + (ledSeed % 41) / 10}s`;
    }
    return n;
  }
  const leds = () => el('span', { class: 'leds', ariaHidden: 'true' }, led('pwr'), led('act'), led('act amber'));
  IT.leds = leds;

  function card(t) {
    const fav = store.fav.includes(t.id);
    return el('a', { class: 'card', href: '#/' + t.id }, el('span', { class: 'bay', ariaHidden: 'true' }, led('pwr'), led('act' + (t.net ? ' amber' : ''))), el('b', { text: t.name }), fav ? el('span', { class: 'pin', title: 'Pinned', text: '★' }) : null, t.net ? el('span', { class: 'tag', text: 'ONLINE' }) : null, el('span', { class: 'vent', ariaHidden: 'true' }));
  }
  const grid = (list) => el('div', { class: 'cards' }, list.map(card));
  const enclosure = (title, list, more) => el('section', { class: 'sec unit' }, leds(), el('div', { class: 'sec-head' }, el('h2', {}, title), el('span', { class: 'count', text: String(more || list.length) })), grid(list));
  const lcd = (t) => el('output', { class: 'lcd', text: t });

  function patchPanel() {
    const read = lcd('');
    const reset = () => { read.textContent = `${tools.length} PORTS UP`; };
    reset();
    const rows = cats.map((c) => {
      const list = tools.filter((t) => t.cat === c.id);
      return el('div', { class: 'pp-row' },
        el('a', { class: 'pp-label', href: '#/c/' + c.id, title: c.name }, el('b', { text: CODE[c.id] }), el('span', { text: c.name })),
        el('div', { class: 'pp-ports' }, list.map((t, i) => {
          const p = el('a', { class: 'port', href: '#/' + t.id, ariaLabel: t.name, onmouseenter: () => { read.textContent = `${CODE[c.id]}-${u.pad(i + 1)}  ${t.name}`; }, onfocus: () => { read.textContent = `${CODE[c.id]}-${u.pad(i + 1)}  ${t.name}`; }, onmouseleave: reset, onblur: reset });
          p.append(led('act' + (t.net ? ' amber' : '')), el('span', { class: 'jack' }));
          return p;
        })));
    });
    return el('div', { class: 'panel', role: 'navigation', ariaLabel: 'All tools as a patch panel' },
      el('div', { class: 'ear l' }, el('i'), el('i')),
      el('div', { class: 'pp-body' }, el('div', { class: 'pp-head' }, el('span', { class: 'pp-brand', text: 'PATCH PANEL' }), read), rows),
      el('div', { class: 'ear r' }, el('i'), el('i')));
  }

  function home() {
    const pins = store.fav.map((id) => byId[id]).filter(Boolean);
    const recent = store.recent.map((id) => byId[id]).filter((t) => t && !store.fav.includes(t.id)).slice(0, 4);
    const m = main();
    m.replaceChildren(...[
      el('header', { class: 'hero unit' }, leds(),
        el('h1', { text: 'IT Tools' }),
        el('button', { class: 'search-hero', type: 'button', onclick: openPalette }, el('span', { text: 'Search' }), el('kbd', { text: 'Ctrl K' })),
        lcd(`${tools.length} UP  /  ${cats.length} RACKS`)),
      patchPanel(),
      pins.length ? enclosure('Pinned', pins) : null,
      recent.length ? enclosure('Recent', recent) : null,
      cats.map((c) => {
        const list = tools.filter((t) => t.cat === c.id);
        return enclosure(el('a', { href: '#/c/' + c.id, text: c.name }), list);
      }),
    ].flat().filter(Boolean));
    document.title = 'IT Tools';
  }

  function category(id) {
    const c = cats.find((x) => x.id === id);
    if (!c) return notFound();
    const list = tools.filter((t) => t.cat === id);
    main().replaceChildren(el('header', { class: 'page-head unit' }, leds(), el('p', { class: 'crumb' }, el('a', { href: '#/', text: 'All tools' })), el('div', { class: 'title-row' }, el('h1', { text: c.name }), lcd(`${list.length} UP`))), el('section', { class: 'sec unit' }, leds(), grid(list)));
    document.title = `${c.name} | IT Tools`;
  }

  function notFound() {
    main().replaceChildren(el('header', { class: 'page-head unit' }, leds(), el('p', { class: 'crumb' }, el('a', { href: '#/', text: 'All tools' })), el('div', { class: 'title-row' }, el('h1', { text: 'No link' }), lcd('404'))));
  }

  function toolPage(t) {
    const cat = cats.find((c) => c.id === t.cat);
    store.recent = [t.id, ...store.recent.filter((x) => x !== t.id)].slice(0, 12);
    save();
    document.title = `${t.name} | IT Tools`;

    const star = el('button', { class: 'star' + (store.fav.includes(t.id) ? ' on' : ''), type: 'button', ariaLabel: 'Pin this tool', ariaPressed: store.fav.includes(t.id), text: store.fav.includes(t.id) ? '★ Pinned' : '☆ Pin', onclick: () => {
      const on = !store.fav.includes(t.id);
      store.fav = on ? [...store.fav, t.id] : store.fav.filter((x) => x !== t.id);
      save();
      star.classList.toggle('on', on);
      star.setAttribute('aria-pressed', on);
      star.textContent = on ? '★ Pinned' : '☆ Pin';
      nav();
    } });
    const head = el('header', { class: 'page-head unit tool' }, leds(), el('p', { class: 'crumb' }, el('a', { href: '#/c/' + cat.id, text: cat.name })), el('div', { class: 'title-row' }, el('h1', { text: t.name }), el('span', { class: 'title-side' }, t.net ? el('span', { class: 'tag', text: 'ONLINE' }) : null, star)));

    const related = tools.filter((x) => x.cat === t.cat && x.id !== t.id);
    const rel = u_rotate(related, t.id).slice(0, 4);
    const foot = rel.length ? enclosure(cat.name, rel) : null;

    if (t.custom) {
      const stage = el('div', { class: 'stage' });
      main().replaceChildren(head, stage, foot || '');
      teardown = IT.custom[t.custom](stage) || null;
      return;
    }

    const vals = IT.defaults(t);
    const out = el('div', { class: 'output', ariaLive: 'polite' });
    const empty = () => out.replaceChildren(el('div', { class: 'empty unit' }, leds(), el('span', { class: 'vent wide', ariaHidden: 'true' })));
    let token = 0, timer = null, tickT = null, flashT = null;
    const flash = () => { document.body.classList.add('busy'); clearTimeout(flashT); flashT = setTimeout(() => document.body.classList.remove('busy'), 700); };

    const exec = async () => {
      const mine = ++token;
      if (!t.tick) flash();
      if (t.manual) out.replaceChildren(el('div', { class: 'empty unit busy' }, leds(), el('span', { class: 'vent wide', ariaHidden: 'true' })));
      try {
        const r = await t.run(vals);
        if (mine !== token) return;
        if (!renderOut(out, r)) empty();
      } catch (e) {
        if (mine !== token) return;
        out.replaceChildren(el('div', { class: 'note bad', role: 'alert', text: netMsg(t, e) }));
      }
    };
    const refreshShow = () => fields.forEach(({ wrap, f }) => { wrap.hidden = !!(f.show && !f.show(vals)); });
    const changed = () => {
      refreshShow();
      fields.forEach((x) => { if (x.f.type === 'seg') x.sync(); });
      if (t.manual) return;
      clearTimeout(timer);
      timer = setTimeout(exec, 90);
    };
    const fields = t.fields.map((f) => fieldEl(f, vals, changed));
    const syncAll = () => { fields.forEach((x) => x.sync()); refreshShow(); };

    const acts = el('div', { class: 'form-acts' });
    if (t.manual) acts.append(el('button', { class: 'primary', type: 'submit', text: t.runLabel || 'Run' }));
    if (t.regen) acts.append(el('button', { class: 'primary', type: 'button', text: 'Generate again', onclick: exec }));
    if (t.sample && Object.keys(t.sample).length) acts.append(el('button', { class: 'ghost', type: 'button', text: 'Try an example', onclick: () => {
      Object.assign(vals, t.sample);
      syncAll();
      if (!t.manual) exec();
    } }));
    if (t.fields.length && t.kind !== 'ref') acts.append(el('button', { class: 'ghost', type: 'button', text: 'Clear', onclick: () => {
      Object.assign(vals, IT.defaults(t));
      syncAll();
      token++;
      if (t.manual) empty(); else exec();
    } }));

    const form = el('form', { class: 'form unit', onsubmit: (e) => { e.preventDefault(); exec(); } }, leds(), fields.map((x) => x.wrap), acts.childNodes.length ? acts : null);
    const wide = t.kind === 'ref' || !t.fields.length;
    const body = el('div', { class: 'tool-body' + (wide ? ' wide' : '') }, t.fields.length ? form : (acts.childNodes.length ? form : null), out);
    main().replaceChildren(head, body, foot || '');
    syncAll();
    empty();
    if (!t.manual) exec();
    if (t.tick) tickT = setInterval(exec, t.tick);
    teardown = () => { clearInterval(tickT); clearTimeout(timer); clearTimeout(flashT); document.body.classList.remove('busy'); token++; };
    const first = $('input:not([type=checkbox]):not([type=range]):not([type=color]), textarea', form);
    if (first && matchMedia('(min-width: 900px)').matches) first.focus({ preventScroll: true });
  }
  const netMsg = (t, e) => (t.net && e instanceof TypeError ? 'The request did not get through. A firewall, proxy or being offline can all cause this.' : e.message || String(e));
  function u_rotate(a, seed) {
    const n = [...seed].reduce((x, c) => x + c.charCodeAt(0), 0) % (a.length || 1);
    return a.slice(n).concat(a.slice(0, n));
  }

  // ---------- routing ----------
  function nav() {
    stop();
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    closeMenu();
    if (!h) home();
    else if (h.startsWith('c/')) category(h.slice(2));
    else if (byId[h]) toolPage(byId[h]);
    else notFound();
    window.scrollTo(0, 0);
    syncNav(h);
  }
  function syncNav(h) {
    const cur = h.startsWith('c/') ? h.slice(2) : byId[h] ? byId[h].cat : '';
    document.querySelectorAll('#nav a').forEach((a) => {
      const on = a.dataset.cat === cur || (!h && a.dataset.cat === 'home');
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  const closeMenu = () => document.body.classList.remove('menu');

  // ---------- command palette ----------
  const pal = { list: [], i: 0 };
  function score(t, q) {
    const n = t.name.toLowerCase();
    if (n === q) return 100;
    if (n.startsWith(q)) return 80;
    if (n.includes(q)) return 60;
    return `${t.tags || ''} ${t.id}`.toLowerCase().includes(q) ? 40 : 0;
  }
  function search(q) {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [...store.recent.map((id) => byId[id]).filter(Boolean), ...tools.filter((t) => t.featured && !store.recent.includes(t.id))].slice(0, 9);
    return tools.map((t) => {
      const s = words.map((w) => score(t, w));
      return [t, s.every(Boolean) ? s.reduce((a, b) => a + b, 0) : 0];
    }).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0]);
  }
  function drawPal() {
    const ul = $('#pal-list');
    ul.replaceChildren(...pal.list.map((t, i) => {
      const a = el('a', { href: '#/' + t.id, class: i === pal.i ? 'on' : '', id: 'pal-' + i, role: 'option', ariaSelected: i === pal.i, onclick: closePalette, onmouseenter: () => { pal.i = i; mark(); } }, led('act' + (t.net ? ' amber' : '')), el('span', { class: 'pal-code', text: CODE[t.cat] }), el('b', { text: t.name }));
      return a;
    }));
    if (!pal.list.length) ul.append(el('p', { class: 'pal-none', text: 'No match' }));
    mark();
  }
  function mark() {
    document.querySelectorAll('#pal-list a').forEach((a, i) => { a.classList.toggle('on', i === pal.i); a.setAttribute('aria-selected', i === pal.i); });
    const on = $('#pal-list a.on');
    if (on) { on.scrollIntoView({ block: 'nearest' }); $('#pal-q').setAttribute('aria-activedescendant', on.id); }
  }
  function openPalette() {
    const d = $('#palette');
    d.hidden = false;
    const q = $('#pal-q');
    q.value = '';
    pal.list = search('');
    pal.i = 0;
    drawPal();
    q.focus();
  }
  function closePalette() { $('#palette').hidden = true; }

  // ---------- start ----------
  function boot() {
    const nv = $('#nav');
    nv.append(el('a', { href: '#/', 'data-cat': 'home' }, led('pwr'), led('act'), el('span', { class: 'nav-name', text: 'All tools' }), el('small', { text: String(tools.length) })));
    for (const c of cats) nv.append(el('a', { href: '#/c/' + c.id, 'data-cat': c.id }, led('pwr'), led('act'), el('span', { class: 'nav-name', text: c.name }), el('small', { text: String(tools.filter((t) => t.cat === c.id).length) })));

    $('#open-search').addEventListener('click', openPalette);
    $('#menu-btn').addEventListener('click', () => document.body.classList.toggle('menu'));
    $('#scrim').addEventListener('click', closeMenu);
    $('#theme-btn').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(dark ? 'light' : 'dark');
    });
    $('#palette').addEventListener('mousedown', (e) => { if (e.target.id === 'palette') closePalette(); });
    $('#pal-q').addEventListener('input', (e) => { pal.list = search(e.target.value); pal.i = 0; drawPal(); });
    $('#pal-q').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); pal.i = Math.min(pal.i + 1, pal.list.length - 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); pal.i = Math.max(pal.i - 1, 0); mark(); }
      else if (e.key === 'Enter' && pal.list[pal.i]) { e.preventDefault(); location.hash = '#/' + pal.list[pal.i].id; closePalette(); }
      else if (e.key === 'Tab') e.preventDefault();
    });
    document.addEventListener('keydown', (e) => {
      if (document.body.dataset.capture) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      else if (e.key === 'Escape' && !$('#palette').hidden) closePalette();
      else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
    });
    addEventListener('hashchange', nav);
    nav();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
