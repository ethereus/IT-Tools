/* IT Tools core: the tool registry and shared helpers.
   Nothing in this file touches the DOM, so every tool's logic can be
   unit tested under plain Node (see tests/run.mjs). */
(function (g) {
  'use strict';

  const IT = (g.IT = { tools: [], byId: {}, u: {} });
  const u = IT.u;

  IT.cats = [
    { id: 'network', name: 'Subnets & IP' },
    { id: 'infra', name: 'Network Ops' },
    { id: 'web', name: 'DNS & Web' },
    { id: 'security', name: 'Security' },
    { id: 'soc', name: 'Investigate' },
    { id: 'encode', name: 'Encoding' },
    { id: 'data', name: 'Text & Data' },
    { id: 'time', name: 'Time' },
    { id: 'windows', name: 'Windows & AD' },
    { id: 'linux', name: 'Linux & Servers' },
    { id: 'capacity', name: 'Capacity' },
    { id: 'helpdesk', name: 'Helpdesk' },
  ];

  IT.tool = function (d) {
    if (IT.byId[d.id]) throw new Error('Duplicate tool id: ' + d.id);
    if (!IT.cats.some((c) => c.id === d.cat)) throw new Error('Unknown category: ' + d.cat);
    d.fields = d.fields || [];
    IT.tools.push(d);
    IT.byId[d.id] = d;
    return d;
  };

  /** Register a searchable reference table. */
  IT.ref = function (d) {
    const { head, rows } = d;
    return IT.tool({
      ...d,
      kind: 'ref',
      fields: [{ k: 'q', type: 'text', label: 'Filter', ph: d.ph || 'Type to filter…' }],
      sample: { q: d.sampleQ || '' },
      run(v) {
        const q = (v.q || '').trim().toLowerCase();
        const hit = q ? rows.filter((r) => r.join(' ').toLowerCase().includes(q)) : rows;
        return [{ table: { head, rows: hit }, note: `${hit.length} of ${rows.length} entries` }];
      },
    });
  };

  /** Starting values for a tool's fields, optionally merged with its example. */
  IT.defaults = function (t, withSample) {
    const v = {};
    for (const f of t.fields) {
      let d = typeof f.value === 'function' ? f.value() : f.value;
      if (d === undefined) {
        const o = f.options && f.options[0];
        d = f.type === 'check' ? false : f.type === 'file' ? null : o !== undefined ? (Array.isArray(o) ? o[0] : o) : '';
      }
      v[f.k] = d;
    }
    return withSample && t.sample ? { ...v, ...t.sample } : v;
  };

  // ---------- bytes and text ----------
  const te = new TextEncoder();
  u.utf8 = (s) => te.encode(s);
  u.fromUtf8 = (b, fatal) => new TextDecoder('utf-8', { fatal: !!fatal }).decode(b);
  u.hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  u.unhex = (s) => {
    const c = s.replace(/^0x/i, '').replace(/[\s:,-]|0x/gi, '');
    if (c.length % 2 || /[^0-9a-f]/i.test(c)) throw new Error('That is not valid hex.');
    const o = new Uint8Array(c.length / 2);
    for (let i = 0; i < o.length; i++) o[i] = parseInt(c.substr(i * 2, 2), 16);
    return o;
  };
  u.b64 = (b) => {
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  u.unb64 = (s) => {
    let c = String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (c.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(c)) throw new Error('That is not valid Base64.');
    c = c.replace(/=+$/, '');
    c = c.padEnd(c.length + ((4 - (c.length % 4)) % 4), '=');
    const r = atob(c);
    const o = new Uint8Array(r.length);
    for (let i = 0; i < r.length; i++) o[i] = r.charCodeAt(i);
    return o;
  };
  u.b64url = (b) => u.b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  u.lines = (s) => String(s || '').split(/\r?\n/);
  u.tokens = (s) => String(s || '').split(/[\s,;]+/).filter(Boolean);
  u.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- randomness (always the CSPRNG, unbiased) ----------
  u.randBytes = (n) => {
    const o = new Uint8Array(n);
    for (let i = 0; i < n; i += 65536) crypto.getRandomValues(o.subarray(i, Math.min(i + 65536, n)));
    return o;
  };
  u.randInt = (n) => {
    if (n < 1 || n > 4294967296) throw new Error('randInt range');
    const lim = Math.floor(4294967296 / n) * n;
    const a = new Uint32Array(1);
    do crypto.getRandomValues(a);
    while (a[0] >= lim);
    return a[0] % n;
  };
  u.pick = (a) => a[u.randInt(a.length)];
  u.shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = u.randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- number and size formatting ----------
  u.nf = (n, d) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d === undefined ? 2 : d });
  u.fmtBytes = (n, base) => {
    base = base || 1024;
    const un = base === 1024 ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'] : ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    let i = 0;
    let x = Number(n);
    while (Math.abs(x) >= base && i < un.length - 1) {
      x /= base;
      i++;
    }
    return u.nf(x, 2) + ' ' + un[i];
  };
  u.fmtDur = (s) => {
    s = Math.abs(s);
    if (s < 1) return u.nf(s * 1000, 1) + ' ms';
    const part = [];
    const put = (n, l) => n && part.push(n + ' ' + l + (n === 1 ? '' : 's'));
    const whole = Math.floor(s);
    put(Math.floor(whole / 86400), 'day');
    put(Math.floor((whole % 86400) / 3600), 'hour');
    put(Math.floor((whole % 3600) / 60), 'minute');
    const rest = s - Math.floor(whole / 60) * 60;
    if (rest >= 0.005) part.push(u.nf(rest, s < 60 ? 2 : 0) + ' second' + (rest === 1 ? '' : 's'));
    return part.join(' ') || '0 seconds';
  };
  u.pad = (n, w) => String(n).padStart(w || 2, '0');

  // ---------- IPv4 ----------
  u.parseIPv4 = (s) => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());
    if (!m) throw new Error(`"${s}" is not a valid IPv4 address.`);
    let n = 0;
    for (let i = 1; i <= 4; i++) {
      if (+m[i] > 255) throw new Error(`"${s}" has an octet above 255.`);
      n = n * 256 + +m[i];
    }
    return n;
  };
  u.fmtIPv4 = (n) => [n / 16777216, (n / 65536) % 256, (n / 256) % 256, n % 256].map(Math.floor).join('.');
  u.maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  u.prefixOfMask = (m) => {
    const n = u.parseIPv4(m);
    for (let p = 0; p <= 32; p++) if (u.maskOf(p) === n) return p;
    throw new Error(`${m} is not a contiguous subnet mask.`);
  };
  /** Accepts 10.0.0.1/24, 10.0.0.1 255.255.255.0, or a bare address (/32). */
  u.parseCIDR = (s) => {
    const t = String(s).trim().split(/[\s/]+/);
    if (!t[0]) throw new Error('Enter an IPv4 address or CIDR block.');
    const ip = u.parseIPv4(t[0]);
    let p = 32;
    if (t[1] !== undefined) {
      if (/^\d{1,2}$/.test(t[1])) p = +t[1];
      else p = u.prefixOfMask(t[1]);
    }
    if (p > 32) throw new Error('A prefix length must be between 0 and 32.');
    const mask = u.maskOf(p);
    const net = (ip & mask) >>> 0;
    const size = 2 ** (32 - p);
    return { ip, prefix: p, mask, net, bcast: net + size - 1, size };
  };
  u.usable = (p) => (p === 32 ? 1 : p === 31 ? 2 : 2 ** (32 - p) - 2);
  u.ipv4Type = (n) => {
    const inb = (c) => {
      const x = u.parseCIDR(c);
      return n >= x.net && n <= x.bcast;
    };
    const t = [
      ['0.0.0.0/8', 'This network (RFC 1122)'], ['10.0.0.0/8', 'Private (RFC 1918)'], ['100.64.0.0/10', 'Carrier-grade NAT (RFC 6598)'],
      ['127.0.0.0/8', 'Loopback'], ['169.254.0.0/16', 'Link-local / APIPA'], ['172.16.0.0/12', 'Private (RFC 1918)'],
      ['192.0.0.0/24', 'IETF protocol assignment'], ['192.0.2.0/24', 'Documentation (TEST-NET-1)'], ['192.168.0.0/16', 'Private (RFC 1918)'],
      ['198.18.0.0/15', 'Benchmarking (RFC 2544)'], ['198.51.100.0/24', 'Documentation (TEST-NET-2)'], ['203.0.113.0/24', 'Documentation (TEST-NET-3)'],
      ['224.0.0.0/4', 'Multicast'], ['255.255.255.255/32', 'Limited broadcast'], ['240.0.0.0/4', 'Reserved'],
    ];
    for (const [c, l] of t) if (inb(c)) return l;
    return 'Public';
  };
  /** Smallest set of CIDR blocks covering start..end inclusive. */
  u.rangeToCidrs = (start, end) => {
    const out = [];
    let cur = start;
    while (cur <= end) {
      let bits = 0;
      while (bits < 32 && cur % 2 ** (bits + 1) === 0 && cur + 2 ** (bits + 1) - 1 <= end) bits++;
      out.push(`${u.fmtIPv4(cur)}/${32 - bits}`);
      cur += 2 ** bits;
    }
    return out;
  };

  // ---------- IPv6 ----------
  u.parseIPv6 = (input) => {
    let s = String(input).trim().split('%')[0];
    const bad = () => new Error(`"${input}" is not a valid IPv6 address.`);
    if (!s || !/^[0-9a-f:.]+$/i.test(s) || !s.includes(':')) throw bad();
    const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (v4) {
      const n = u.parseIPv4(v4[1]);
      s = s.slice(0, v4.index) + Math.floor(n / 65536).toString(16) + ':' + (n % 65536).toString(16);
    }
    const dbl = s.split('::');
    if (dbl.length > 2) throw bad();
    const grp = (x) => (x ? x.split(':') : []);
    const left = grp(dbl[0]);
    const right = dbl.length === 2 ? grp(dbl[1]) : [];
    const fill = 8 - left.length - right.length;
    if (dbl.length === 2 ? fill < 1 : fill !== 0) throw bad();
    const all = left.concat(Array(Math.max(fill, 0)).fill('0'), right);
    let n = 0n;
    for (const h of all) {
      if (!/^[0-9a-f]{1,4}$/i.test(h)) throw bad();
      n = (n << 16n) | BigInt(parseInt(h, 16));
    }
    return n;
  };
  u.ipv6Groups = (n) => {
    const g6 = [];
    for (let i = 0; i < 8; i++) g6.unshift(Number((n >> BigInt(i * 16)) & 0xffffn));
    return g6;
  };
  u.ipv6Full = (n) => u.ipv6Groups(n).map((x) => x.toString(16).padStart(4, '0')).join(':');
  /** RFC 5952 canonical text form. */
  u.ipv6Short = (n) => {
    const g6 = u.ipv6Groups(n);
    let bs = -1, bl = 0, cs = -1, cl = 0;
    for (let i = 0; i < 8; i++) {
      if (g6[i] === 0) {
        if (cs < 0) { cs = i; cl = 0; }
        cl++;
        if (cl > bl) { bs = cs; bl = cl; }
      } else cs = -1;
    }
    const h = g6.map((x) => x.toString(16));
    if (bl < 2) return h.join(':');
    return h.slice(0, bs).join(':') + '::' + h.slice(bs + bl).join(':');
  };
  u.parseV6CIDR = (s) => {
    const [a, p] = String(s).trim().split('/');
    const ip = u.parseIPv6(a);
    const prefix = p === undefined ? 128 : +p;
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) throw new Error('An IPv6 prefix must be between 0 and 128.');
    const hostBits = BigInt(128 - prefix);
    const hostMask = (1n << hostBits) - 1n;
    const net = ip & ~hostMask & ((1n << 128n) - 1n);
    return { ip, prefix, net, last: net | hostMask, hostBits };
  };
  u.ipv6Type = (n) => {
    const top = (b, v) => n >> BigInt(128 - b) === v;
    if (n === 0n) return 'Unspecified (::)';
    if (n === 1n) return 'Loopback (::1)';
    if (n >> 32n === 0xffffn) return 'IPv4-mapped';
    if (top(96, 0x0064ff9b0000000000000000n)) return 'NAT64 well-known prefix';
    if (top(32, 0x20010db8n)) return 'Documentation';
    if (top(16, 0x2002n)) return '6to4';
    if (top(32, 0x20010000n)) return 'Teredo';
    if (top(8, 0xffn)) return 'Multicast';
    if (top(10, 0x3fan)) return 'Link-local';
    if (top(10, 0x3fbn)) return 'Site-local (deprecated)';
    if (top(7, 0x7en)) return 'Unique local (ULA)';
    if (top(3, 0x1n)) return 'Global unicast';
    return 'Reserved';
  };
  u.ip6Arpa = (n) => u.ipv6Full(n).replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa';

  // ---------- MAC ----------
  u.parseMac = (s) => {
    const c = String(s).replace(/[^0-9a-f]/gi, '').toLowerCase();
    if (c.length !== 12) throw new Error(`"${String(s).trim()}" is not a 48-bit MAC address.`);
    return c;
  };

  // ---------- hashes that WebCrypto does not provide ----------
  function padLE(b) {
    const ml = b.length;
    const n = (((ml + 8) >> 6) + 1) * 16;
    const w = new Uint32Array(n);
    for (let i = 0; i < ml; i++) w[i >> 2] |= b[i] << ((i % 4) * 8);
    w[ml >> 2] |= 0x80 << ((ml % 4) * 8);
    w[n - 2] = (ml * 8) >>> 0;
    w[n - 1] = Math.floor((ml * 8) / 4294967296);
    return w;
  }
  const rol = (x, n) => (x << n) | (x >>> (32 - n));
  const outLE = (st) => {
    const o = new Uint8Array(16);
    new DataView(o.buffer).setInt32(0, st[0], true);
    new DataView(o.buffer).setInt32(4, st[1], true);
    new DataView(o.buffer).setInt32(8, st[2], true);
    new DataView(o.buffer).setInt32(12, st[3], true);
    return o;
  };
  const MD5K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  const MD5S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  u.md5 = (b) => {
    const w = padLE(b);
    let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];
    for (let o = 0; o < w.length; o += 16) {
      let [A, B, C, D] = [a0, b0, c0, d0];
      for (let i = 0; i < 64; i++) {
        const r = i >> 4;
        let F, gi;
        if (r === 0) { F = (B & C) | (~B & D); gi = i; }
        else if (r === 1) { F = (D & B) | (~D & C); gi = (5 * i + 1) % 16; }
        else if (r === 2) { F = B ^ C ^ D; gi = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); gi = (7 * i) % 16; }
        F = (F + A + MD5K[i] + w[o + gi]) | 0;
        A = D; D = C; C = B;
        B = (B + rol(F, MD5S[r * 4 + (i % 4)])) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    return outLE([a0, b0, c0, d0]);
  };
  u.md4 = (b) => {
    const w = padLE(b);
    let [a, bb, c, d] = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];
    const F = (x, y, z) => (x & y) | (~x & z);
    const G = (x, y, z) => (x & y) | (x & z) | (y & z);
    const H = (x, y, z) => x ^ y ^ z;
    for (let o = 0; o < w.length; o += 16) {
      const [aa, ab, ac, ad] = [a, bb, c, d];
      const X = (i) => w[o + i];
      const R = (f, k, s, K) => {
        const t = rol((a + f(bb, c, d) + X(k) + K) | 0, s);
        a = d; d = c; c = bb; bb = t;
      };
      for (let i = 0; i < 16; i++) R(F, i, [3, 7, 11, 19][i % 4], 0);
      for (let i = 0; i < 16; i++) R(G, ((i % 4) * 4 + (i >> 2)) % 16, [3, 5, 9, 13][i % 4], 0x5a827999);
      const ord = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
      for (let i = 0; i < 16; i++) R(H, ord[i], [3, 9, 11, 15][i % 4], 0x6ed9eba1);
      a = (a + aa) | 0; bb = (bb + ab) | 0; c = (c + ac) | 0; d = (d + ad) | 0;
    }
    return outLE([a, bb, c, d]);
  };
  const CRC_T = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  u.crc32 = (b) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  u.adler32 = (b) => {
    let a = 1, c = 0;
    for (let i = 0; i < b.length; i++) {
      a = (a + b[i]) % 65521;
      c = (c + a) % 65521;
    }
    return (c * 65536 + a) >>> 0;
  };
  const needSubtle = () => {
    if (!g.crypto || !crypto.subtle) throw new Error('This needs a secure context. Open the site over HTTPS or from localhost.');
    return crypto.subtle;
  };
  u.subtle = needSubtle;
  u.sha = async (alg, b) => new Uint8Array(await needSubtle().digest(alg, b));
  u.hmac = async (alg, key, msg) => {
    const k = await needSubtle().importKey('raw', key.length ? key : new Uint8Array(1), { name: 'HMAC', hash: alg }, false, ['sign']);
    return new Uint8Array(await needSubtle().sign('HMAC', k, msg));
  };

  // ---------- CSV ----------
  u.parseCSV = (text, d) => {
    d = d || ',';
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
        } else f += c;
      } else if (c === '"' && f === '') q = true;
      else if (c === d) { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  };
  u.csvCell = (v, d) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.includes(d || ',') || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // ---------- date helpers ----------
  u.iso = (d) => {
    if (isNaN(d)) throw new Error('That date is out of range.');
    return d.toISOString();
  };
  u.ago = (ms) => {
    const s = Math.abs(ms) / 1000;
    const txt = s < 60 ? `${Math.round(s)} seconds` : s < 3600 ? `${Math.round(s / 60)} minutes` : s < 86400 ? `${u.nf(s / 3600, 1)} hours` : `${u.nf(s / 86400, 1)} days`;
    return ms >= 0 ? `${txt} ago` : `in ${txt}`;
  };
})(globalThis);
