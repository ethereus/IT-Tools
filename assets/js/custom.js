(function () {
  'use strict';
  const { u } = IT;
  const el = (...a) => IT.el(...a);
  IT.custom = {};

  const permMsg = (e) => ({ NotAllowedError: 'Permission was denied. Allow access from the padlock in the address bar, and check Windows privacy settings.', NotFoundError: 'No matching device was found.', NotReadableError: 'The device is in use by another app, or its driver has failed.' }[e.name] || e.message);
  const needMedia = () => {
    if (!navigator.mediaDevices) throw new Error('Device access needs HTTPS or localhost. Open the site over HTTPS to use this.');
  };

  // ---------- System info ----------
  IT.custom.systemInfo = function (root) {
    const out = el('div', { class: 'output' });
    let text = '';
    const copy = el('button', { class: 'primary', type: 'button', text: 'Copy for ticket', onclick: () => IT.copy(text) });
    root.append(el('div', { class: 'form-acts' }, copy), out);
    (async () => {
      const n = navigator, s = screen, kv = [];
      const add = (k, v) => { if (v !== undefined && v !== null && v !== '') kv.push([k, String(v)]); };
      const ua = n.userAgentData;
      const hi = ua ? await ua.getHighEntropyValues(['platformVersion', 'architecture', 'bitness', 'fullVersionList']).catch(() => null) : null;
      if (hi) {
        const b = (hi.fullVersionList || []).find((x) => !/Not.?A.?Brand/i.test(x.brand) && x.brand !== 'Chromium') || (hi.fullVersionList || [])[0];
        if (b) add('Browser', `${b.brand} ${b.version}`);
        const major = parseInt(hi.platformVersion, 10);
        add('Operating system', ua.platform === 'Windows' ? (major >= 13 ? 'Windows 11 or later' : 'Windows 10 or earlier') : `${ua.platform} ${hi.platformVersion}`);
        add('Architecture', `${hi.architecture} ${hi.bitness}-bit`);
      }
      add('User agent', n.userAgent);
      add('Language', (n.languages || [n.language]).join(', '));
      add('Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
      add('Local time', new Date().toString());
      add('CPU threads', n.hardwareConcurrency);
      add('Memory (approximate)', n.deviceMemory && `${n.deviceMemory} GB or more`);
      add('Screen', `${s.width} x ${s.height} at ${devicePixelRatio * 100}% scale`);
      add('Physical pixels', `${Math.round(s.width * devicePixelRatio)} x ${Math.round(s.height * devicePixelRatio)}`);
      add('Window', `${innerWidth} x ${innerHeight}`);
      add('Colour depth', `${s.colorDepth}-bit`);
      add('Touch points', n.maxTouchPoints);
      try {
        const g = document.createElement('canvas').getContext('webgl');
        const d = g && g.getExtension('WEBGL_debug_renderer_info');
        add('Graphics', d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g ? g.getParameter(g.RENDERER) : 'WebGL unavailable');
      } catch { /* no WebGL */ }
      add('Online', n.onLine ? 'Yes' : 'No');
      if (n.connection) add('Network estimate', `${n.connection.effectiveType || '?'}, ${n.connection.downlink || '?'} Mbps, ${n.connection.rtt || '?'} ms`);
      if (n.getBattery) { try { const b = await n.getBattery(); add('Battery', `${Math.round(b.level * 100)}% ${b.charging ? '(charging)' : '(on battery)'}`); } catch { /* unavailable */ } }
      if (n.storage && n.storage.estimate) { try { const e = await n.storage.estimate(); add('Browser storage', `${u.fmtBytes(e.usage || 0)} of ${u.fmtBytes(e.quota || 0)}`); } catch { /* unavailable */ } }
      add('Cookies enabled', n.cookieEnabled ? 'Yes' : 'No');
      add('Do Not Track', n.doNotTrack === '1' ? 'On' : 'Off');
      add('Secure context', isSecureContext ? 'Yes' : 'No');
      text = kv.map(([k, v]) => `${k}: ${v}`).join('\n');
      IT.renderOut(out, { kv });
    })();
  };

  // ---------- Keyboard ----------
  const KB = [
    ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'PrintScreen', 'ScrollLock', 'Pause'],
    ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace:2', 'Insert', 'Home', 'PageUp'],
    ['Tab:1.5', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash:1.5', 'Delete', 'End', 'PageDown'],
    ['CapsLock:1.75', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter:2.25'],
    ['ShiftLeft:2.25', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight:2.75', 'ArrowUp'],
    ['ControlLeft:1.25', 'MetaLeft:1.25', 'AltLeft:1.25', 'Space:6.25', 'AltRight:1.25', 'ContextMenu:1.25', 'ControlRight:1.25', 'ArrowLeft', 'ArrowDown', 'ArrowRight'],
  ];
  const NICE = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Escape: 'Esc', PrintScreen: 'PrtSc', ScrollLock: 'ScrLk', Backspace: 'Bksp', Delete: 'Del', Insert: 'Ins', PageUp: 'PgUp', PageDown: 'PgDn', CapsLock: 'Caps', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', MetaLeft: 'Win', AltLeft: 'Alt', AltRight: 'Alt', ContextMenu: 'Menu', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space' };
  const label = (c) => NICE[c] || c.replace(/^Key|^Digit/, '');
  IT.custom.keyboard = function (root) {
    const keys = {};
    const seen = new Set();
    const last = el('code', { class: 'v', text: 'Press any key' });
    const count = el('b', { text: '0' });
    const total = KB.flat().length;
    const board = el('div', { class: 'kbd', role: 'img', ariaLabel: 'Keyboard map' }, KB.map((row) => el('div', { class: 'kbd-row' }, row.map((k) => {
      const [c, w] = k.split(':');
      const n = el('span', { class: 'key', text: label(c) });
      n.style.flexGrow = w || 1;
      keys[c] = n;
      return n;
    }))));
    root.append(el('div', { class: 'tool-meta' }, el('span', {}, count, ` of ${total} keys seen`), last, el('button', { class: 'mini', type: 'button', text: 'Reset', onclick: () => { seen.clear(); Object.values(keys).forEach((k) => k.classList.remove('hit', 'down')); count.textContent = '0'; } })), board);
    document.body.dataset.capture = '1';
    const dn = (e) => {
      e.preventDefault();
      last.textContent = `key "${e.key}"   code ${e.code}   keyCode ${e.keyCode}`;
      const k = keys[e.code];
      if (k) { k.classList.add('down', 'hit'); seen.add(e.code); count.textContent = seen.size; }
    };
    const up = (e) => { e.preventDefault(); if (keys[e.code]) keys[e.code].classList.remove('down'); };
    addEventListener('keydown', dn, true);
    addEventListener('keyup', up, true);
    return () => { delete document.body.dataset.capture; removeEventListener('keydown', dn, true); removeEventListener('keyup', up, true); };
  };

  // ---------- Mouse ----------
  IT.custom.mouse = function (root) {
    const names = ['Left', 'Middle', 'Right', 'Back', 'Forward'];
    const counts = names.map(() => 0), lastT = names.map(() => 0);
    const cells = names.map((n) => { const c = el('b', { text: '0' }); const box = el('div', { class: 'stat' }, IT.leds(), el('span', { text: n }), c); return { c, box }; });
    const wheel = el('b', { text: '0' });
    const warn = el('div', { class: 'note', role: 'status', hidden: true });
    let bounce = 0, ticks = 0;
    const pad = el('div', { class: 'pad', tabIndex: 0, ariaLabel: 'Mouse test area', onmousedown: (e) => {
      e.preventDefault();
      const b = e.button, now = performance.now();
      if (!names[b]) return;
      counts[b]++;
      cells[b].c.textContent = counts[b];
      cells[b].box.classList.add('hit');
      setTimeout(() => cells[b].box.classList.remove('hit'), 120);
      if (now - lastT[b] < 60) { bounce++; warn.hidden = false; warn.className = 'note bad'; warn.textContent = `${bounce} double-click(s) on ${names[b]}, ${Math.round(now - lastT[b])} ms apart`; }
      lastT[b] = now;
    }, oncontextmenu: (e) => e.preventDefault(), onauxclick: (e) => e.preventDefault(), onwheel: (e) => { e.preventDefault(); ticks++; wheel.textContent = `${ticks} ${e.deltaY < 0 ? '↑' : '↓'}`; } });
    root.append(el('div', { class: 'stats' }, cells.map((x) => x.box), el('div', { class: 'stat' }, IT.leds(), el('span', { text: 'Wheel' }), wheel)), pad, warn);
  };

  // ---------- Camera ----------
  IT.custom.camera = function (root) {
    let stream;
    const v = el('video', { class: 'video', autoplay: true, playsInline: true, muted: true });
    const info = el('div', { class: 'note', role: 'status', hidden: true });
    const pick = el('select', { ariaLabel: 'Camera', hidden: true, onchange: () => start() });
    const off = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; v.srcObject = null; };
    async function start() {
      off();
      info.hidden = false;
      try {
        needMedia();
        stream = await navigator.mediaDevices.getUserMedia({ video: pick.value ? { deviceId: { exact: pick.value } } : { width: { ideal: 1920 } } });
        v.srcObject = stream;
        const cur = stream.getVideoTracks()[0], s = cur.getSettings();
        info.className = 'note ok';
        info.textContent = `${cur.label || 'Camera'}: ${s.width} x ${s.height} at ${Math.round(s.frameRate || 0)} fps`;
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        pick.replaceChildren(...devs.map((d, i) => el('option', { value: d.deviceId, text: d.label || `Camera ${i + 1}` })));
        pick.value = s.deviceId;
        pick.hidden = devs.length < 2;
      } catch (e) { info.className = 'note bad'; info.textContent = permMsg(e); }
    }
    root.append(el('div', { class: 'form-acts' }, el('button', { class: 'primary', type: 'button', text: 'Start camera', onclick: start }), el('button', { class: 'ghost', type: 'button', text: 'Stop', onclick: off }), pick), info, v);
    return off;
  };

  // ---------- Microphone ----------
  IT.custom.mic = function (root) {
    let stream, ac, raf;
    const fill = el('i', { class: 'ok' });
    const val = el('b', { text: '-' });
    const peakEl = el('b', { text: '-' });
    const info = el('div', { class: 'note', role: 'status', hidden: true });
    const off = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; if (ac) ac.close(); ac = null; fill.style.width = '0'; };
    async function start() {
      off();
      info.hidden = false;
      try {
        needMedia();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ac = new AudioContext();
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        ac.createMediaStreamSource(stream).connect(an);
        const d = new Float32Array(an.fftSize);
        let peak = -100;
        info.className = 'note ok';
        info.textContent = `Listening on: ${stream.getAudioTracks()[0].label || 'default input'}`;
        const draw = () => {
          an.getFloatTimeDomainData(d);
          const rms = Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length);
          const db = Math.max(-80, 20 * Math.log10(rms || 1e-8));
          peak = Math.max(peak, db);
          fill.style.width = `${Math.max(0, (db + 60) / 60) * 100}%`;
          val.textContent = `${Math.round(db)} dB`;
          peakEl.textContent = `${Math.round(peak)} dB`;
          raf = requestAnimationFrame(draw);
        };
        draw();
      } catch (e) { info.className = 'note bad'; info.textContent = permMsg(e); }
    }
    root.append(el('div', { class: 'form-acts' }, el('button', { class: 'primary', type: 'button', text: 'Start listening', onclick: start }), el('button', { class: 'ghost', type: 'button', text: 'Stop', onclick: off })), info, el('div', { class: 'block' }, el('div', { class: 'meter-row' }, el('span', { text: 'Input level' }), val), el('div', { class: 'meter tall' }, fill), el('div', { class: 'meter-row' }, el('span', { text: 'Peak' }), peakEl)));
    return off;
  };

  // ---------- Speakers ----------
  IT.custom.speaker = function (root) {
    let ac;
    const play = (pan, label) => {
      ac = ac || new AudioContext();
      ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner();
      o.frequency.value = 440;
      p.pan.value = pan;
      const t = ac.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.05);
      g.gain.setValueAtTime(0.18, t + 1.2);
      g.gain.linearRampToValueAtTime(0, t + 1.5);
      o.connect(g).connect(p).connect(ac.destination);
      o.start(t);
      o.stop(t + 1.55);
      now.hidden = false;
      now.textContent = `440 Hz: ${label}`;
    };
    const now = el('div', { class: 'note', role: 'status', hidden: true });
    root.append(el('div', { class: 'form-acts' }, el('button', { class: 'primary', type: 'button', text: 'Left', onclick: () => play(-1, 'left channel') }), el('button', { class: 'primary', type: 'button', text: 'Both', onclick: () => play(0, 'both channels') }), el('button', { class: 'primary', type: 'button', text: 'Right', onclick: () => play(1, 'right channel') })), now);
    return () => { if (ac) ac.close(); };
  };

  // ---------- Display ----------
  IT.custom.screen = function (root) {
    const list = [['White', 'white'], ['Black', 'black'], ['Red', 'red'], ['Green', 'green'], ['Blue', 'blue'], ['Grey ramp', 'ramp'], ['Checkerboard', 'check']];
    const stage = el('div', { class: 'screen-stage' });
    let i = 0;
    const show = (n) => { i = n % list.length; stage.dataset.p = list[i][1]; };
    stage.addEventListener('click', () => show(i + 1));
    const go = (n) => { show(n); if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {}); };
    root.append(el('div', { class: 'form-acts' }, list.map(([n], idx) => el('button', { class: 'ghost', type: 'button', text: n, onclick: () => go(idx) }))), stage);
    show(0);
    return () => { if (document.fullscreenElement) document.exitFullscreen(); };
  };

  // ---------- Timer ----------
  IT.custom.timer = function (root) {
    const face = el('div', { class: 'clock', role: 'timer', text: '00:00:00' });
    const laps = el('ol', { class: 'laps' });
    const mins = el('input', { type: 'number', value: 15, min: 0, id: 'tm', step: 'any' });
    let mode = 'stop', base = 0, running = false, since = 0, target = 0, t;
    const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${u.pad(Math.floor(s / 3600))}:${u.pad(Math.floor((s % 3600) / 60))}:${u.pad(s % 60)}`; };
    const beep = () => { try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); g.gain.value = 0.15; o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.6); o.onended = () => a.close(); } catch { /* audio blocked */ } };
    const tick = () => {
      if (mode === 'stop') face.textContent = fmt(Math.floor((base + (running ? performance.now() - since : 0)) / 1000) * 1000);
      else {
        const left = target - Date.now();
        face.textContent = fmt(left);
        if (left <= 0 && running) { running = false; face.classList.add('done'); beep(); IT.toast('Time is up'); }
      }
    };
    t = setInterval(tick, 200);
    const sw = el('button', { class: 'primary', type: 'button', text: 'Start stopwatch', onclick: () => {
      face.classList.remove('done');
      mode = 'stop';
      if (running) { base += performance.now() - since; running = false; sw.textContent = 'Resume stopwatch'; }
      else { since = performance.now(); running = true; sw.textContent = 'Pause stopwatch'; }
      tick();
    } });
    const lap = el('button', { class: 'ghost', type: 'button', text: 'Lap', onclick: () => laps.append(el('li', { text: face.textContent })) });
    const cd = el('button', { class: 'primary', type: 'button', text: 'Start countdown', onclick: () => {
      face.classList.remove('done');
      mode = 'cd';
      target = Date.now() + (+mins.value || 0) * 60000;
      running = true;
      tick();
    } });
    const rs = el('button', { class: 'ghost', type: 'button', text: 'Reset', onclick: () => { running = false; base = 0; mode = 'stop'; laps.replaceChildren(); face.classList.remove('done'); sw.textContent = 'Start stopwatch'; tick(); } });
    root.append(face, el('div', { class: 'form-acts' }, sw, lap, rs), el('div', { class: 'form-acts' }, el('label', { for: 'tm', class: 'lab', text: 'Minutes' }), mins, cd), laps);
    return () => clearInterval(t);
  };

  // ---------- Speed test ----------
  IT.custom.speedTest = function (root) {
    const B = 'https://speed.cloudflare.com';
    const mk = (n) => { const b = el('b', { text: '-' }); return { b, box: el('div', { class: 'stat' }, el('span', { text: n }), b) }; };
    const lat = mk('Latency'), jit = mk('Jitter'), dn = mk('Download'), up = mk('Upload');
    const info = el('div', { class: 'note', role: 'status', text: 'Uses up to 110 MB of data' });
    let dead = false;
    let ctl = null;
    const run = async () => {
      go.disabled = true;
      ctl = new AbortController();
      const s = ctl.signal;
      [lat, jit, dn, up].forEach((x) => { x.b.textContent = '-'; });
      info.className = 'note';
      try {
        info.textContent = 'Measuring latency…';
        const p = [];
        for (let i = 0; i < 10 && !dead; i++) {
          const t = performance.now();
          await (await fetch(`${B}/__down?bytes=0`, { cache: 'no-store', signal: s })).arrayBuffer();
          p.push(performance.now() - t);
        }
        p.sort((a, b) => a - b);
        lat.b.textContent = `${Math.round(p[Math.floor(p.length / 2)])} ms`;
        jit.b.textContent = `${u.nf(p.slice(1).reduce((a, x, i) => a + Math.abs(x - p[i]), 0) / (p.length - 1), 1)} ms`;
        info.textContent = 'Measuring download…';
        const best = { d: 0, u: 0 };
        for (const size of [1e6, 1e7, 2.5e7, 5e7]) {
          if (dead) return;
          const t = performance.now();
          let rd;
          try {
            const r = await fetch(`${B}/__down?bytes=${size}`, { cache: 'no-store', signal: s });
            if (!r.ok) throw new Error('rate limited');
            rd = r.body.getReader();
          } catch (e) {
            if (best.d) break;
            throw e;
          }
          let got = 0;
          for (;;) {
            const { done, value } = await rd.read();
            if (done) break;
            got += value.length;
            const e = (performance.now() - t) / 1000;
            if (e > 0.2) { best.d = Math.max(best.d, (got * 8) / e / 1e6); dn.b.textContent = `${u.nf(best.d, 1)} Mbps`; }
          }
          if ((performance.now() - t) / 1000 > 4) break;
        }
        info.textContent = 'Measuring upload…';
        for (const size of [1e6, 5e6, 2e7]) {
          if (dead) return;
          const body = new Uint8Array(size);
          const t = performance.now();
          await fetch(`${B}/__up`, { method: 'POST', body, signal: s });
          const e = (performance.now() - t) / 1000;
          best.u = Math.max(best.u, (size * 8) / e / 1e6);
          up.b.textContent = `${u.nf(best.u, 1)} Mbps`;
          if (e > 4) break;
        }
        info.className = 'note ok';
        info.textContent = 'Done';
      } catch (e) {
        if (dead) return;
        info.className = 'note bad';
        info.textContent = 'The test was blocked or interrupted. A firewall or filtering proxy is the usual cause.';
      } finally { go.disabled = false; }
    };
    const go = el('button', { class: 'primary', type: 'button', text: 'Start test', onclick: run });
    [lat, jit, dn, up].forEach((x) => x.box.prepend(IT.leds()));
    root.append(el('div', { class: 'form-acts' }, go), el('div', { class: 'stats' }, lat.box, jit.box, dn.box, up.box), info);
    return () => { dead = true; if (ctl) ctl.abort(); };
  };
})();
