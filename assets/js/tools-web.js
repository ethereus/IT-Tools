(function () {
  'use strict';
  const { tool: T, ref, u } = IT;
  const P = (s) => s.split('|');

  // ---------- DNS over HTTPS ----------
  const RR = { A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28, SRV: 33, CAA: 257, TLSA: 52 };
  const RRN = Object.fromEntries(Object.entries(RR).map(([k, v]) => [v, k]));
  const RCODE = ['NOERROR', 'FORMERR', 'SERVFAIL', 'NXDOMAIN', 'NOTIMP', 'REFUSED'];
  async function doh(name, type) {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
    if (!r.ok) throw new Error(`The DNS resolver returned HTTP ${r.status}.`);
    return r.json();
  }
  IT.doh = doh;
  const answers = (j, type) => (j.Answer || []).filter((a) => !type || a.type === RR[type]);
  const unq = (s) => s.replace(/^"|"$/g, '').replace(/"\s+"/g, '');
  const needHost = (s) => {
    const h = s.trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
    if (!h) return '';
    if (!/^[a-z0-9_.:-]+$/i.test(h)) throw new Error('Enter a plain domain name.');
    return h;
  };

  T({
    id: 'dns-lookup', name: 'DNS Lookup', cat: 'web', net: true, manual: true, featured: true,
    tags: 'nslookup dig resolve a aaaa mx txt ns cname soa srv caa',
    fields: [
      { k: 'name', type: 'text', label: 'Name', ph: 'example.com', mono: true },
      { k: 'type', type: 'select', label: 'Record type', options: ['ALL', ...Object.keys(RR)], value: 'ALL' },
    ],
    sample: { name: 'cloudflare.com', type: 'ALL' },
    async run(v) {
      const h = needHost(v.name);
      if (!h) return null;
      const types = v.type === 'ALL' ? ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA'] : [v.type];
      const res = await Promise.all(types.map((t) => doh(h, t).then((j) => [t, j])));
      const rows = [], seen = new Set();
      let status = 0;
      for (const [, j] of res) {
        status = Math.max(status, j.Status);
        for (const a of j.Answer || []) {
          const key = a.type + a.name + a.data;
          if (!seen.has(key)) { seen.add(key); rows.push([RRN[a.type] || a.type, a.name, a.TTL, a.data]); }
        }
      }
      if (!rows.length) return { note: `No records. Resolver status: ${RCODE[status] || status}.`, tone: 'warn' };
      return { table: { head: ['Type', 'Name', 'TTL', 'Value'], rows } };
    },
  });

  T({
    id: 'email-dns-audit', name: 'Email Domain Audit', cat: 'web', net: true, manual: true, featured: true,
    tags: 'spf dkim dmarc mx deliverability spoofing',
    fields: [{ k: 'd', type: 'text', label: 'Domain', ph: 'example.com', mono: true }, { k: 'sel', type: 'text', label: 'DKIM selectors to try', value: 'default selector1 selector2 google k1 s1 s2 dkim mail', mono: true }],
    sample: { d: 'cloudflare.com' },
    async run(v) {
      const d = needHost(v.d);
      if (!d) return null;
      const [mx, txt, dm] = await Promise.all([doh(d, 'MX'), doh(d, 'TXT'), doh('_dmarc.' + d, 'TXT')]);
      const out = [];
      const mxs = answers(mx, 'MX').map((a) => a.data);
      out.push({ note: mxs.length ? `MX: ${mxs.length} record${mxs.length > 1 ? 's' : ''} found.` : 'MX: no records, so this domain cannot receive mail.', tone: mxs.length ? 'ok' : 'bad' });
      const txts = answers(txt, 'TXT').map((a) => unq(a.data));
      const spf = txts.filter((t) => /^v=spf1/i.test(t));
      if (spf.length > 1) out.push({ note: `SPF: ${spf.length} records found. More than one is a permanent error.`, tone: 'bad' });
      else if (!spf.length) out.push({ note: 'SPF: missing.', tone: 'bad' });
      else {
        const all = (/[~?+-]?all\b/.exec(spf[0]) || ['none'])[0];
        out.push({ note: `SPF: present, ends in ${all}.`, tone: all === '-all' || all === '~all' ? 'ok' : 'warn' });
      }
      const dmr = answers(dm, 'TXT').map((a) => unq(a.data)).find((t) => /^v=dmarc1/i.test(t));
      if (!dmr) out.push({ note: 'DMARC: missing.', tone: 'bad' });
      else {
        const p = (/\bp=(\w+)/i.exec(dmr) || [])[1] || 'unknown';
        out.push({ note: `DMARC: present, policy is ${p}.`, tone: p === 'none' ? 'warn' : 'ok' });
      }
      const sels = u.tokens(v.sel).slice(0, 15);
      const dk = await Promise.all(sels.map(async (s) => { const j = await doh(`${s}._domainkey.${d}`, 'TXT'); return [s, answers(j, 'TXT').map((a) => unq(a.data)).join('')]; }));
      const found = dk.filter((x) => x[1]);
      out.push({ note: found.length ? `DKIM: found selector ${found.map((x) => x[0]).join(', ')}.` : 'DKIM: none of those selectors exist. The domain may use a different selector.', tone: found.length ? 'ok' : 'warn' });
      const kv = [['MX', mxs.join('\n') || '-'], ['SPF', spf.join('\n') || '-'], ['DMARC', dmr || '-']];
      found.forEach(([s, val]) => kv.push(['DKIM ' + s, val]));
      out.push({ kv });
      return out;
    },
  });

  T({
    id: 'rdap-lookup', name: 'RDAP / WHOIS Lookup', cat: 'web', net: true, manual: true,
    tags: 'whois registrar owner registration expiry asn netblock',
    fields: [{ k: 'q', type: 'text', label: 'Domain, IP address or AS number', ph: 'example.com, 8.8.8.8 or AS15169', mono: true }],
    sample: { q: 'example.com' },
    async run(v) {
      const q = v.q.trim();
      if (!q) return null;
      const kind = /^as\d+$/i.test(q) ? 'autnum/' + q.slice(2) : /^[\d.]+$|:/.test(q) ? 'ip/' + q : 'domain/' + needHost(q);
      let r;
      try {
        r = await fetch('https://rdap.org/' + kind, { headers: { accept: 'application/rdap+json' } });
      } catch {
        throw new Error('This registry cannot be reached from here.');
      }
      if (r.status === 404) return { note: 'Nothing is registered under that name.', tone: 'warn' };
      if (!r.ok) throw new Error(`RDAP returned HTTP ${r.status}.`);
      const j = await r.json();
      const ev = (a) => ((j.events || []).find((e) => e.eventAction === a) || {}).eventDate || '-';
      const ent = (role) => {
        const e = (j.entities || []).find((x) => (x.roles || []).includes(role));
        return e ? ((e.vcardArray || [, []])[1].find((c) => c[0] === 'fn') || [])[3] || e.handle || '-' : '-';
      };
      const kv = [['Handle', j.handle || '-'], ['Name', j.ldhName || j.name || '-'], ['Status', (j.status || []).join(', ') || '-'], ['Registrar', ent('registrar')], ['Registrant', ent('registrant')], ['Registered', ev('registration')], ['Last changed', ev('last changed')], ['Expires', ev('expiration')]];
      if (j.startAddress) kv.push(['Range', `${j.startAddress} - ${j.endAddress}`]);
      if (j.nameservers) kv.push(['Nameservers', j.nameservers.map((n) => n.ldhName).join('\n')]);
      return { kv: kv.filter((x) => x[1] !== '-') };
    },
  });

  T({
    id: 'my-ip', name: 'My Public IP', cat: 'web', net: true, manual: true, featured: true,
    tags: 'whatismyip external wan address',
    runLabel: 'Check my IP',
    fields: [],
    sample: {},
    async run() {
      const get = (url) => fetch(url).then((r) => r.text()).then((t) => Object.fromEntries(t.trim().split('\n').map((l) => l.split('=')))).catch(() => null);
      const [a, b] = await Promise.all([get('https://1.1.1.1/cdn-cgi/trace'), get('https://www.cloudflare.com/cdn-cgi/trace')]);
      if (!a && !b) throw new Error('Could not reach the lookup service. A proxy or filter may be blocking it.');
      const x = b || a;
      return { kv: [['Public IPv4', a ? a.ip : 'Unavailable'], ['Preferred address', b ? b.ip : 'Unavailable'], ['IPv6', b && b.ip.includes(':') ? 'Yes' : 'No'], ['Country', x.loc || '-'], ['Cloudflare site', x.colo || '-'], ['TLS', x.tls || '-'], ['HTTP', x.http || '-']] };
    },
  });

  T({
    id: 'speed-test', name: 'Internet Speed Test', cat: 'web', net: true, featured: true,
    tags: 'bandwidth download upload ping latency jitter',
    custom: 'speedTest',
    fields: [],
  });

  T({
    id: 'reverse-dns', name: 'PTR Record Builder', cat: 'web',
    tags: 'reverse in-addr.arpa ip6.arpa ptr zone',
    fields: [{ k: 'list', type: 'area', label: 'One entry per line: address hostname', rows: 6, ph: '192.0.2.10 mail.example.com' }],
    sample: { list: '192.0.2.10 mail.example.com\n2001:db8::25 mail.example.com' },
    run(v) {
      const r = u.lines(v.list).map((l) => l.trim()).filter(Boolean).map((l) => {
        const [a, h] = l.split(/\s+/);
        const name = a.includes(':') ? u.ip6Arpa(u.parseIPv6(a)) : u.fmtIPv4(u.parseIPv4(a)).split('.').reverse().join('.') + '.in-addr.arpa';
        return h ? `${name}. IN PTR ${h.replace(/\.?$/, '.')}` : name;
      });
      return r.length ? r.join('\n') : null;
    },
  });

  T({
    id: 'spf-analyzer', name: 'SPF Record Analyzer', cat: 'web',
    tags: 'email sender policy include permerror',
    fields: [{ k: 'r', type: 'area', label: 'SPF record', rows: 3, ph: 'v=spf1 include:_spf.google.com ~all' }],
    sample: { r: 'v=spf1 ip4:192.0.2.0/24 include:_spf.google.com include:spf.protection.outlook.com a mx ~all' },
    run(v) {
      const parts = v.r.trim().replace(/^"|"$/g, '').split(/\s+/).filter(Boolean);
      if (!parts.length) return null;
      if (!/^v=spf1$/i.test(parts[0])) throw new Error('An SPF record must start with v=spf1.');
      const Q = { '+': 'Pass', '-': 'Fail', '~': 'Soft fail', '?': 'Neutral' };
      let n = 0;
      const rows = parts.slice(1).map((p) => {
        const m = /^([+\-~?]?)([a-z0-9]+)(?:[:=/](.*))?$/i.exec(p) || [];
        const q = m[1] || '+', k = (m[2] || p).toLowerCase(), val = m[3] || '';
        const dns = ['include', 'a', 'mx', 'ptr', 'exists', 'redirect'].includes(k);
        if (dns) n++;
        const what = { ip4: `Allow IPv4 ${val}`, ip6: `Allow IPv6 ${val}`, include: `Also apply the policy at ${val}`, a: `Allow the A records of ${val || 'this domain'}`, mx: `Allow the mail servers of ${val || 'this domain'}`, ptr: 'Reverse DNS match (deprecated)', exists: `Pass if ${val} resolves`, redirect: `Use the policy at ${val} instead`, all: 'Everything else' }[k] || 'Unknown term';
        return [p, Q[q], what, dns ? 'Yes' : 'No'];
      });
      return [
        { note: n > 10 ? `${n} DNS lookups in this record alone. Over 10 causes a permanent error.` : `${n} direct DNS lookups of the 10 allowed. Includes can add more of their own.`, tone: n > 10 ? 'bad' : n > 7 ? 'warn' : 'ok' },
        { table: { head: ['Term', 'Result', 'Meaning', 'DNS lookup'], rows } },
      ];
    },
  });

  T({
    id: 'dmarc-builder', name: 'DMARC Record Builder', cat: 'web',
    tags: 'email policy rua ruf quarantine reject',
    fields: [
      { k: 'd', type: 'text', label: 'Domain', value: 'example.com', mono: true },
      { k: 'p', type: 'seg', label: 'Policy', options: ['none', 'quarantine', 'reject'], value: 'quarantine' },
      { k: 'rua', type: 'text', label: 'Aggregate report address', value: 'dmarc@example.com', mono: true },
      { k: 'pct', type: 'num', label: 'Percent of mail', value: 100, min: 0, max: 100 },
      { k: 'strict', type: 'check', label: 'Strict SPF and DKIM alignment' },
    ],
    sample: {},
    run(v) {
      const t = ['v=DMARC1', `p=${v.p}`];
      if (v.rua.trim()) t.push(`rua=mailto:${v.rua.trim()}`);
      if (+v.pct !== 100) t.push(`pct=${v.pct}`);
      if (v.strict) t.push('adkim=s', 'aspf=s');
      return { kv: [['Host', `_dmarc.${v.d.trim()}`], ['Type', 'TXT'], ['Value', t.join('; ')]] };
    },
  });

  T({
    id: 'url-parser', name: 'URL Parser', cat: 'web',
    tags: 'query string params host path decode',
    fields: [{ k: 'x', type: 'area', label: 'URL', rows: 3, ph: 'https://user@example.com:8443/path?a=1#top' }],
    sample: { x: 'https://user@portal.example.com:8443/app/login?next=%2Fhome&tab=security&id=42#section-2' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      let p;
      try { p = new URL(s); } catch { throw new Error('That is not a complete URL. Include the scheme, such as https://'); }
      const kv = [['Scheme', p.protocol.replace(':', '')], ['Host', p.hostname], ['Port', p.port || '(default)'], ['Path', p.pathname], ['Fragment', p.hash.slice(1) || '-'], ['Origin', p.origin]];
      if (p.username) kv.push(['Username', p.username]);
      const qs = [...p.searchParams];
      return [{ kv }, qs.length ? { title: 'Query parameters', table: { head: ['Name', 'Value'], rows: qs } } : null];
    },
  });

  T({
    id: 'user-agent-parser', name: 'User-Agent Parser', cat: 'web',
    tags: 'browser os device bot',
    fields: [{ k: 'x', type: 'area', label: 'User-Agent', rows: 3, ph: 'Paste a User-Agent string' }],
    sample: { x: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      const m = (re) => { const r = re.exec(s); return r ? r[1] : null; };
      const b = [['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/], ['Opera', /OPR\/([\d.]+)/], ['Firefox', /Firefox\/([\d.]+)/], ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/], ['Safari', /Version\/([\d.]+).*Safari/], ['Internet Explorer', /(?:MSIE |rv:)([\d.]+)\)? like Gecko|MSIE ([\d.]+)/]].find(([, r]) => r.test(s));
      const os = /Windows NT 10/.test(s) ? 'Windows 10 or 11' : /Windows NT 6\.3/.test(s) ? 'Windows 8.1' : /Windows NT 6\.1/.test(s) ? 'Windows 7' : /Windows/.test(s) ? 'Windows' : /Android ([\d.]+)/.test(s) ? 'Android ' + m(/Android ([\d.]+)/) : /(?:iPhone|iPad).*OS ([\d_]+)/.test(s) ? 'iOS ' + m(/OS ([\d_]+)/).replace(/_/g, '.') : /Mac OS X ([\d_.]+)/.test(s) ? 'macOS ' + m(/Mac OS X ([\d_.]+)/).replace(/_/g, '.') : /CrOS/.test(s) ? 'ChromeOS' : /Linux/.test(s) ? 'Linux' : 'Unknown';
      const bot = /bot|crawl|spider|slurp|curl|wget|python-requests|httpclient/i.test(s);
      return { kv: [['Browser', b ? `${b[0]} ${m(b[1]) || ''}`.trim() : 'Unknown'], ['Engine', /Gecko\/\d/.test(s) ? 'Gecko' : /Trident/.test(s) ? 'Trident' : /Chrome|CriOS/.test(s) ? 'Blink' : /AppleWebKit/.test(s) ? 'WebKit' : 'Unknown'], ['Operating system', os], ['Device', bot ? 'Bot or script' : /iPad|Tablet/.test(s) ? 'Tablet' : /Mobile|iPhone|Android/.test(s) ? 'Mobile' : 'Desktop']] };
    },
  });

  const HEADERS = [
    ['strict-transport-security', 'HSTS', (x) => (/max-age=(\d+)/i.exec(x) || [0, 0])[1] >= 15552000 ? null : 'max-age should be at least 15552000 (6 months).'],
    ['content-security-policy', 'CSP', (x) => (/unsafe-inline|unsafe-eval/.test(x) ? 'Contains unsafe-inline or unsafe-eval.' : null)],
    ['x-content-type-options', 'MIME sniffing', (x) => (/nosniff/i.test(x) ? null : 'Should be nosniff.')],
    ['x-frame-options', 'Clickjacking', null],
    ['referrer-policy', 'Referrer leakage', (x) => (/unsafe-url/i.test(x) ? 'unsafe-url leaks the full URL.' : null)],
    ['permissions-policy', 'Browser features', null],
  ];
  T({
    id: 'security-headers', name: 'Security Headers Analyzer', cat: 'web',
    tags: 'hsts csp x-frame-options http response audit',
    fields: [{ k: 'x', type: 'area', label: 'Response headers', rows: 9, ph: 'Output of: curl -sI https://example.com' }],
    sample: { x: 'HTTP/2 200\nserver: nginx/1.24.0\nstrict-transport-security: max-age=31536000; includeSubDomains\nx-content-type-options: nosniff\ncontent-security-policy: default-src \'self\' \'unsafe-inline\'\nset-cookie: sid=abc; Path=/' },
    run(v) {
      if (!v.x.trim()) return null;
      const h = {};
      for (const l of u.lines(v.x)) {
        const m = /^([\w-]+):\s*(.*)$/.exec(l.trim());
        if (m) (h[m[1].toLowerCase()] = h[m[1].toLowerCase()] || []).push(m[2]);
      }
      const rows = HEADERS.map(([n, what, chk]) => {
        const val = (h[n] || []).join(', ');
        if (!val) return [n, what, n === 'x-frame-options' && /frame-ancestors/i.test((h['content-security-policy'] || []).join()) ? 'OK via CSP' : 'Missing'];
        const p = chk && chk(val);
        return [n, what, p ? 'Warning: ' + p : 'OK'];
      });
      const score = rows.filter((r) => r[2].startsWith('OK')).length;
      const leaks = ['server', 'x-powered-by', 'x-aspnet-version'].filter((k) => h[k]).map((k) => `${k}: ${h[k][0]}`);
      const cookies = (h['set-cookie'] || []).filter((c) => !/;\s*secure/i.test(c) || !/;\s*httponly/i.test(c));
      return [
        { meter: { label: 'Security headers', value: score / rows.length, text: `${score} of ${rows.length} OK`, good: true } },
        { table: { head: ['Header', 'Protects against', 'Result'], rows } },
        leaks.length ? { note: `Version disclosure: ${leaks.join('; ')}`, tone: 'warn' } : null,
        cookies.length ? { note: `${cookies.length} cookie(s) missing Secure or HttpOnly.`, tone: 'warn' } : null,
      ];
    },
  });

  T({
    id: 'curl-builder', name: 'cURL Command Builder', cat: 'web',
    tags: 'http request api test post json powershell invoke-webrequest',
    fields: [
      { k: 'method', type: 'select', label: 'Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], value: 'GET' },
      { k: 'url', type: 'text', label: 'URL', value: 'https://api.example.com/v1/items', mono: true },
      { k: 'hdr', type: 'area', label: 'Headers, one per line', rows: 3, value: 'Accept: application/json' },
      { k: 'body', type: 'area', label: 'Body', rows: 3, show: (v) => !['GET', 'HEAD'].includes(v.method) },
      { k: 'k', type: 'check', label: 'Skip TLS verification (-k)' },
      { k: 'v', type: 'check', label: 'Verbose (-v)' },
      { k: 'follow', type: 'check', label: 'Follow redirects (-L)', value: true },
    ],
    sample: { method: 'POST', body: '{"name":"test"}' },
    run(v) {
      const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
      const a = ['curl'];
      if (v.follow) a.push('-L');
      if (v.k) a.push('-k');
      if (v.v) a.push('-v');
      if (v.method === 'HEAD') a.push('-I');
      else if (v.method !== 'GET') a.push(`-X ${v.method}`);
      u.lines(v.hdr).map((h) => h.trim()).filter(Boolean).forEach((h) => a.push(`-H ${q(h)}`));
      if (v.body && !['GET', 'HEAD'].includes(v.method)) a.push(`--data-raw ${q(v.body)}`);
      a.push(q(v.url.trim()));
      const hs = u.lines(v.hdr).map((h) => h.trim()).filter(Boolean).map((h) => { const i = h.indexOf(':'); return `'${h.slice(0, i).trim()}'='${h.slice(i + 1).trim().replace(/'/g, "''")}'`; });
      const ps = [`Invoke-WebRequest -Method ${v.method} -Uri '${v.url.trim().replace(/'/g, "''")}'`];
      if (hs.length) ps.push(`-Headers @{${hs.join('; ')}}`);
      if (v.body && !['GET', 'HEAD'].includes(v.method)) ps.push(`-Body '${v.body.replace(/'/g, "''")}'`);
      return [{ title: 'Bash', text: a.join(' \\\n  ') }, { title: 'PowerShell', text: ps.join(' `\n  ') }];
    },
  });

  T({
    id: 'basic-auth', name: 'Basic Auth Header', cat: 'web',
    tags: 'authorization http base64 header',
    fields: [
      { k: 'mode', type: 'seg', label: 'Mode', options: ['Encode', 'Decode'], value: 'Encode' },
      { k: 'user', type: 'text', label: 'Username', show: (v) => v.mode === 'Encode' },
      { k: 'pass', type: 'password', label: 'Password', show: (v) => v.mode === 'Encode' },
      { k: 'hdr', type: 'text', label: 'Header value', mono: true, show: (v) => v.mode === 'Decode' },
    ],
    sample: { mode: 'Encode', user: 'svc_backup', pass: 'example-only' },
    run(v) {
      if (v.mode === 'Decode') {
        if (!v.hdr.trim()) return null;
        const d = u.fromUtf8(u.unb64(v.hdr.replace(/^.*Basic\s+/i, '').trim()));
        const i = d.indexOf(':');
        return { kv: [['Username', d.slice(0, i)], ['Password', d.slice(i + 1)]] };
      }
      if (!v.user) return null;
      return `Authorization: Basic ${u.b64(u.utf8(`${v.user}:${v.pass}`))}`;
    },
  });

  T({
    id: 'cookie-parser', name: 'Cookie Parser', cat: 'web',
    tags: 'http session header samesite secure',
    fields: [{ k: 'x', type: 'area', label: 'Header value', rows: 4, ph: 'sid=abc; Path=/; Secure; HttpOnly' }],
    sample: { x: 'sid=9f3a; Path=/; Domain=example.com; Secure; HttpOnly; SameSite=Lax; Max-Age=3600' },
    run(v) {
      const rows = v.x.replace(/^(set-)?cookie:\s*/i, '').split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
        const i = s.indexOf('=');
        return i < 0 ? [s, '(flag)'] : [s.slice(0, i), decodeURIComponentSafe(s.slice(i + 1))];
      });
      return rows.length ? { table: { head: ['Name', 'Value'], rows } } : null;
    },
  });
  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }

  T({
    id: 'qr-wifi', name: 'Wi-Fi QR Code', cat: 'web', featured: true,
    tags: 'wireless guest ssid password scan join',
    fields: [
      { k: 'ssid', type: 'text', label: 'Network name (SSID)' },
      { k: 'auth', type: 'select', label: 'Security', options: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'Open']], value: 'WPA' },
      { k: 'pass', type: 'password', label: 'Password', show: (v) => v.auth !== 'nopass' },
      { k: 'hidden', type: 'check', label: 'Hidden network' },
    ],
    sample: { ssid: 'Guest-WiFi', auth: 'WPA', pass: 'welcome-to-the-office' },
    run(v) {
      if (!v.ssid) return null;
      const e = (s) => s.replace(/([\\;,:"])/g, '\\$1');
      const s = `WIFI:T:${v.auth};S:${e(v.ssid)};${v.auth !== 'nopass' ? `P:${e(v.pass)};` : ''}${v.hidden ? 'H:true;' : ''};`;
      return [{ svg: IT.qrSvg(s), name: 'wifi-qr.svg', title: v.ssid }, { title: 'Encoded payload', text: s }];
    },
  });

  T({
    id: 'qr-generator', name: 'QR Code Generator', cat: 'web',
    tags: 'qrcode barcode url label',
    fields: [
      { k: 'x', type: 'area', label: 'Content', rows: 4, ph: 'https://intranet.example.com/help' },
      { k: 'ec', type: 'seg', label: 'Error correction', options: ['L', 'M', 'Q', 'H'], value: 'M' },
    ],
    sample: { x: 'https://intranet.example.com/help', ec: 'M' },
    run(v) {
      if (!v.x) return null;
      return { svg: IT.qrSvg(v.x, v.ec), name: 'qr.svg' };
    },
  });
  IT.qrMatrix = function (text, ec) {
    /* global qrcode */
    const qr = qrcode(0, ec || 'M');
    qr.stringToBytes = qrcode.stringToBytesFuncs ? qrcode.stringToBytesFuncs['UTF-8'] : qr.stringToBytes;
    qrcode.stringToBytes = (s) => Array.from(u.utf8(s));
    qr.addData(text, 'Byte');
    try { qr.make(); } catch { throw new Error('That is too much text for a QR code.'); }
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  };
  IT.qrSvg = function (text, ec) {
    const m = IT.qrMatrix(text, ec), q = 4, n = m.length + q * 2;
    let d = '';
    m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q} ${y + q}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  };

  // Code 128 set B: printable ASCII asset tags
  const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
  IT.code128 = function (t) {
    const codes = [104];
    for (const ch of t) {
      const c = ch.charCodeAt(0);
      if (c < 32 || c > 126) throw new Error('Code 128 set B covers printable ASCII only.');
      codes.push(c - 32);
    }
    codes.push(codes.reduce((a, c, i) => a + c * (i || 1), 0) % 103, 106);
    return codes;
  };
  T({
    id: 'barcode-generator', name: 'Asset Tag Barcode', cat: 'helpdesk',
    tags: 'code128 label print inventory asset',
    fields: [{ k: 'x', type: 'text', label: 'Tag text', ph: 'IT-004217', mono: true }],
    sample: { x: 'IT-004217' },
    run(v) {
      const t = v.x;
      if (!t) return null;
      let x = 10, bars = '';
      for (const c of IT.code128(t)) {
        const w = C128[c].split('').map(Number);
        w.forEach((n, i) => { if (i % 2 === 0) bars += `<rect x="${x}" y="8" width="${n}" height="60"/>`; x += n; });
      }
      const W = x + 10;
      return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 90" shape-rendering="crispEdges"><rect width="${W}" height="90" fill="#fff"/><g fill="#000">${bars}</g><text x="${W / 2}" y="83" font-family="monospace" font-size="12" text-anchor="middle" fill="#000">${u.esc(t)}</text></svg>`, name: `barcode-${t.replace(/[^\w-]/g, '_')}.svg`, wide: true };
    },
  });

  ref({
    id: 'http-status', name: 'HTTP Status Codes', cat: 'web',
    tags: '404 500 502 503 error response',
    ph: '502, gateway, forbidden…',
    head: ['Code', 'Name', 'Meaning'],
    rows: `100|Continue|Keep sending the request body
101|Switching Protocols|Upgrading, usually to WebSocket
200|OK|Success
201|Created|A new resource now exists
202|Accepted|Queued for later processing
204|No Content|Success with an empty body
206|Partial Content|Range request satisfied
301|Moved Permanently|Update your link
302|Found|Temporary redirect
303|See Other|Fetch the result with GET
304|Not Modified|Cached copy is still good
307|Temporary Redirect|Same as 302, keeps the method
308|Permanent Redirect|Same as 301, keeps the method
400|Bad Request|Malformed request
401|Unauthorized|Authentication needed or failed
403|Forbidden|Authenticated but not allowed
404|Not Found|Nothing at that path
405|Method Not Allowed|Wrong verb for this endpoint
406|Not Acceptable|Cannot match the Accept header
407|Proxy Authentication Required|The proxy wants credentials
408|Request Timeout|Client was too slow
409|Conflict|State conflict, such as an edit clash
410|Gone|Removed on purpose
411|Length Required|Content-Length missing
413|Content Too Large|Upload exceeds the limit
414|URI Too Long|Often a redirect loop
415|Unsupported Media Type|Wrong Content-Type
418|I'm a Teapot|The joke that became a standard
421|Misdirected Request|Wrong server for this TLS connection
422|Unprocessable Content|Valid syntax, invalid data
423|Locked|WebDAV lock
425|Too Early|Replay risk on TLS early data
426|Upgrade Required|Client must change protocol
428|Precondition Required|Conditional request needed
429|Too Many Requests|Rate limited
431|Request Header Fields Too Large|Often oversized cookies
451|Unavailable For Legal Reasons|Blocked by law
500|Internal Server Error|Unhandled error, check the app log
501|Not Implemented|Server does not support the feature
502|Bad Gateway|Upstream gave a bad reply or none
503|Service Unavailable|Overloaded or in maintenance
504|Gateway Timeout|Upstream took too long
505|HTTP Version Not Supported|Unsupported protocol version
507|Insufficient Storage|Server is out of disk
508|Loop Detected|WebDAV loop
511|Network Authentication Required|Captive portal`.split('\n').map(P),
  });

  ref({
    id: 'dns-records', name: 'DNS Record Types', cat: 'web',
    tags: 'a aaaa mx cname txt srv ptr soa ns caa',
    head: ['Type', 'Purpose', 'Example'],
    rows: `A|IPv4 address|www IN A 192.0.2.1
AAAA|IPv6 address|www IN AAAA 2001:db8::1
CNAME|Alias to another name|app IN CNAME www.example.com.
MX|Mail server, with priority|@ IN MX 10 mail.example.com.
NS|Authoritative name server|@ IN NS ns1.example.com.
PTR|Reverse lookup|1.2.0.192.in-addr.arpa. IN PTR www.example.com.
SOA|Zone authority and timers|@ IN SOA ns1.example.com. admin.example.com. (...)
SRV|Service location|_sip._tcp IN SRV 10 60 5060 sip.example.com.
TXT|Free text, SPF, verification|@ IN TXT "v=spf1 mx -all"
CAA|Which CAs may issue certificates|@ IN CAA 0 issue "letsencrypt.org"
DNSKEY|Public key for DNSSEC|@ IN DNSKEY 257 3 13 ...
DS|Delegation signer for DNSSEC|sub IN DS 12345 13 2 ...
TLSA|DANE certificate pin|_443._tcp IN TLSA 3 1 1 ...
SSHFP|SSH host key fingerprint|host IN SSHFP 4 2 ...
SVCB / HTTPS|Service binding and ALPN hints|@ IN HTTPS 1 . alpn="h2,h3"
NAPTR|Name rewrite for SIP and ENUM|@ IN NAPTR 100 10 "U" "E2U+sip" ...`.split('\n').map(P),
  });

  const MIMES = `.html|text/html
.css|text/css
.js|text/javascript
.mjs|text/javascript
.json|application/json
.xml|application/xml
.txt|text/plain
.csv|text/csv
.md|text/markdown
.png|image/png
.jpg, .jpeg|image/jpeg
.gif|image/gif
.webp|image/webp
.avif|image/avif
.svg|image/svg+xml
.ico|image/vnd.microsoft.icon
.pdf|application/pdf
.zip|application/zip
.gz|application/gzip
.tar|application/x-tar
.7z|application/x-7z-compressed
.rar|application/vnd.rar
.doc|application/msword
.docx|application/vnd.openxmlformats-officedocument.wordprocessingml.document
.xls|application/vnd.ms-excel
.xlsx|application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
.ppt|application/vnd.ms-powerpoint
.pptx|application/vnd.openxmlformats-officedocument.presentationml.presentation
.msi|application/x-msdownload
.exe|application/vnd.microsoft.portable-executable
.apk|application/vnd.android.package-archive
.iso|application/x-iso9660-image
.mp3|audio/mpeg
.wav|audio/wav
.mp4|video/mp4
.webm|video/webm
.woff2|font/woff2
.wasm|application/wasm
.pem|application/x-pem-file
.crt, .cer|application/x-x509-ca-cert
.p12, .pfx|application/x-pkcs12
.eml|message/rfc822`.split('\n').map(P);
  ref({ id: 'mime-types', name: 'MIME Type Lookup', cat: 'web', tags: 'content-type media extension', head: ['Extension', 'Content type'], rows: MIMES });

  // ---------- Investigate ----------
  T({
    id: 'email-header-analyzer', name: 'Email Header Analyzer', cat: 'soc', featured: true,
    tags: 'phishing received spf dkim dmarc headers trace mail',
    fields: [{ k: 'x', type: 'area', label: 'Raw message headers', rows: 12, ph: 'Paste the full headers from "Show original"' }],
    sample: { x: 'Received: from mail.sender.example (mail.sender.example [198.51.100.7])\n\tby mx.example.com with ESMTPS id abc123\n\tfor <you@example.com>; Tue, 3 Nov 2026 10:15:30 +0000\nReceived: from app01.internal (app01.internal [10.0.0.5])\n\tby mail.sender.example with ESMTP id def456;\n\tTue, 3 Nov 2026 10:14:58 +0000\nAuthentication-Results: mx.example.com;\n\tspf=pass smtp.mailfrom=sender.example;\n\tdkim=pass header.d=sender.example;\n\tdmarc=fail header.from=paypa1.example\nFrom: "Billing" <billing@paypa1.example>\nReply-To: refunds@other.example\nTo: you@example.com\nSubject: Invoice overdue\nDate: Tue, 3 Nov 2026 10:14:50 +0000\nMessage-ID: <1234@app01.internal>' },
    run(v) {
      if (!v.x.trim()) return null;
      const un = v.x.replace(/\r?\n[ \t]+/g, ' ');
      const hdr = [];
      for (const l of u.lines(un)) {
        const m = /^([\w-]+):\s*(.*)$/.exec(l);
        if (m) hdr.push([m[1].toLowerCase(), m[2]]);
      }
      const get = (n) => (hdr.find((h) => h[0] === n) || [])[1];
      const recv = hdr.filter((h) => h[0] === 'received').map((h) => h[1]).reverse();
      let prev = null;
      const hops = recv.map((r, i) => {
        const t = new Date((r.split(';').pop() || '').trim());
        const delay = prev && !isNaN(t) ? (t - prev) / 1000 : null;
        if (!isNaN(t)) prev = t;
        return [i + 1, (/from\s+(\S+)/i.exec(r) || [])[1] || '-', (/by\s+(\S+)/i.exec(r) || [])[1] || '-', (/\[([\da-f.:]+)\]/i.exec(r) || [])[1] || '-', isNaN(t) ? '-' : t.toISOString().replace('T', ' ').slice(0, 19), delay === null ? '-' : u.fmtDur(delay)];
      });
      const auth = hdr.filter((h) => h[0] === 'authentication-results').map((h) => h[1]).join(' ');
      const verdict = (k) => (new RegExp(`\\b${k}=(\\w+)`, 'i').exec(auth) || [])[1] || 'not reported';
      const dom = (s) => ((/@([\w.-]+)/.exec(s || '') || [])[1] || '').toLowerCase();
      const warn = [];
      const from = get('from'), reply = get('reply-to');
      if (reply && dom(reply) !== dom(from)) warn.push(`Reply-To (${dom(reply)}) differs from From (${dom(from)}).`);
      for (const k of ['spf', 'dkim', 'dmarc']) if (/fail|softfail/i.test(verdict(k))) warn.push(`${k.toUpperCase()} result is ${verdict(k)}.`);
      return [
        warn.length ? { note: warn.join(' '), tone: 'bad' } : { note: 'No obvious red flags in the headers.', tone: 'ok' },
        { kv: [['From', from || '-'], ['Reply-To', reply || '-'], ['To', get('to') || '-'], ['Subject', get('subject') || '-'], ['Date', get('date') || '-'], ['Message-ID', get('message-id') || '-'], ['SPF', verdict('spf')], ['DKIM', verdict('dkim')], ['DMARC', verdict('dmarc')]] },
        hops.length ? { title: 'Route, oldest hop first', table: { head: ['Hop', 'From', 'By', 'IP', 'UTC time', 'Delay'], rows: hops } } : null,
      ];
    },
  });

  const RX = {
    IPv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\[?\.\]?){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    URL: /\bh(?:tt|xx)ps?(?::|\[:\])\/\/[^\s"'<>)\]]+/gi,
    Email: /\b[\w.+-]+(?:@|\[at\]|\[@\])[\w-]+(?:\[?\.\]?[\w-]+)+\b/gi,
    Domain: /\b(?:[a-z0-9-]+\[?\.\]?)+(?:com|net|org|io|co|uk|de|ru|cn|info|biz|xyz|top|online|site|club|app|dev|gov|edu)\b/gi,
    SHA256: /\b[a-f0-9]{64}\b/gi,
    SHA1: /\b[a-f0-9]{40}\b/gi,
    MD5: /\b[a-f0-9]{32}\b/gi,
    CVE: /\bCVE-\d{4}-\d{4,}\b/gi,
  };
  const refang = (s) => s.replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]/gi, '.').replace(/\[:\]/g, ':').replace(/\[@\]|\[at\]/gi, '@').replace(/\bhxxp/gi, 'http');
  T({
    id: 'ioc-extractor', name: 'IOC Extractor', cat: 'soc', featured: true,
    tags: 'indicator compromise threat intel soc extract',
    fields: [{ k: 'x', type: 'area', label: 'Report, email or log text', rows: 10 }, { k: 'defang', type: 'check', label: 'Defang the results' }],
    sample: { x: 'Beacon to hxxps://evil-updates[.]com/gate.php from 10.3.3.7, then 203.0.113[.]55.\nDropper md5 44d88612fea8a8f36de82e1278abb02f. Sender: billing[@]bad-domain.xyz. Exploits CVE-2024-3094.' },
    run(v) {
      if (!v.x.trim()) return null;
      const out = [];
      for (const [k, re] of Object.entries(RX)) {
        let m = [...new Set((v.x.match(re) || []).map(refang))];
        if (k === 'Domain') {
          const skip = new Set((v.x.match(RX.Email) || []).concat(v.x.match(RX.URL) || []).join(' ').toLowerCase().match(/[a-z0-9.-]+\.[a-z]{2,}/g) || []);
          m = m.map((d) => d.toLowerCase()).filter((d) => !skip.has(d) && !refang([...skip].join(' ')).includes(d));
          m = [...new Set(m)];
        }
        if (m.length) out.push({ title: `${k} (${m.length})`, text: (v.defang ? m.map(defang) : m).join('\n') });
      }
      return out.length ? out : { note: 'No indicators found.', tone: 'warn' };
    },
  });
  const defang = (s) => s.replace(/^http/i, 'hxxp').replace(/:\/\//, '[://]').replace(/\./g, '[.]').replace(/@/g, '[@]');
  T({
    id: 'defang', name: 'Defang / Refang', cat: 'soc',
    tags: 'safe link url hxxp indicator',
    fields: [{ k: 'x', type: 'area', label: 'One indicator per line', rows: 6 }, { k: 'mode', type: 'seg', label: 'Mode', options: ['Defang', 'Refang'], value: 'Defang' }],
    sample: { x: 'https://evil.example/path\n203.0.113.55\nphish@bad.example', mode: 'Defang' },
    run(v) {
      if (!v.x.trim()) return null;
      return u.lines(v.x).map((l) => (v.mode === 'Defang' ? defang(l) : refang(l).replace('[://]', '://'))).join('\n');
    },
  });

  const SIGS = [
    ['4d5a', 'Windows executable (PE / DLL)'], ['7f454c46', 'Linux ELF binary'], ['cafebabe', 'Java class or macOS universal binary'], ['feedface', 'macOS Mach-O (32-bit)'], ['feedfacf', 'macOS Mach-O (64-bit)'], ['cffaedfe', 'macOS Mach-O (64-bit, little endian)'],
    ['25504446', 'PDF document'], ['504b0304', 'ZIP container (also DOCX, XLSX, JAR, APK)'], ['d0cf11e0a1b11ae1', 'Legacy Office / OLE2 / MSI'], ['52617221', 'RAR archive'], ['377abcaf271c', '7-Zip archive'], ['1f8b', 'Gzip'], ['fd377a585a00', 'XZ'], ['425a68', 'Bzip2'],
    ['89504e470d0a1a0a', 'PNG image'], ['ffd8ff', 'JPEG image'], ['474946383', 'GIF image'], ['424d', 'BMP image'], ['52494646', 'RIFF (WAV, AVI, WebP)'], ['4f676753', 'Ogg media'], ['494433', 'MP3 audio'], ['1a45dfa3', 'Matroska / WebM'],
    ['4c0000000114020000', 'Windows shortcut (.lnk)'], ['7b5c727466', 'RTF document'], ['53514c69746520666f726d6174203300', 'SQLite database'], ['2321', 'Script with a shebang'], ['3c3f786d6c', 'XML document'], ['3c21646f6374797065', 'HTML document'], ['4344303031', 'ISO image'], ['4d534346', 'Microsoft Cabinet'], ['0061736d', 'WebAssembly'],
  ];
  T({
    id: 'file-identifier', name: 'File Type Identifier', cat: 'soc',
    tags: 'magic bytes signature header extension renamed malware',
    fields: [{ k: 'f', type: 'file', label: 'File' }],
    run(v) {
      if (!v.f) return null;
      const h = u.hex(v.f.bytes.subarray(0, 32));
      const s = SIGS.find(([sig]) => h.startsWith(sig));
      const iso = u.hex(v.f.bytes.subarray(0x8001, 0x8006)) === '4344303031';
      const type = s ? s[1] : iso ? 'ISO image' : 'No known signature, possibly plain text or an unknown format';
      const ext = (v.f.name.split('.').pop() || '').toLowerCase();
      const risky = s && s[0] === '4d5a' && !['exe', 'dll', 'sys', 'scr', 'ocx', 'cpl', 'msi'].includes(ext);
      return [risky ? { note: `Executable content inside a ".${ext}" file. Treat with caution.`, tone: 'bad' } : null, { kv: [['Detected type', type], ['File name', v.f.name], ['Size', u.fmtBytes(v.f.bytes.length)], ['First bytes', h.match(/../g).slice(0, 16).join(' ') || '(empty)']] }];
    },
  });

  T({
    id: 'hex-dump', name: 'Hex Dump Viewer', cat: 'soc',
    tags: 'hexdump xxd binary bytes inspect',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 4 }, { k: 'f', type: 'file', label: 'Or a file (first 64 KB)' }],
    sample: { x: 'Hello, IT team!\n' },
    run(v) {
      const b = v.f ? v.f.bytes.subarray(0, 65536) : u.utf8(v.x);
      if (!b.length) return null;
      const l = [];
      for (let i = 0; i < b.length; i += 16) {
        const s = b.subarray(i, i + 16);
        const hex = Array.from(s, (x) => x.toString(16).padStart(2, '0'));
        l.push(`${i.toString(16).padStart(8, '0')}  ${hex.slice(0, 8).join(' ').padEnd(23)}  ${hex.slice(8).join(' ').padEnd(23)}  |${Array.from(s, (x) => (x > 31 && x < 127 ? String.fromCharCode(x) : '.')).join('')}|`);
      }
      return l.join('\n');
    },
  });

  T({
    id: 'log-triage', name: 'Log Triage', cat: 'soc',
    tags: 'syslog error analyse parser search grep',
    fields: [{ k: 'x', type: 'area', label: 'Log lines', rows: 12 }, { k: 'q', type: 'text', label: 'Keep lines matching (regex, optional)', mono: true }],
    sample: { x: '2026-11-03 10:00:01 INFO auth accepted for alice from 10.0.0.5\n2026-11-03 10:00:04 ERROR auth failed for bob from 203.0.113.9\n2026-11-03 10:00:05 ERROR auth failed for bob from 203.0.113.9\n2026-11-03 10:00:06 WARN disk 91% full\n2026-11-03 10:00:07 ERROR auth failed for root from 203.0.113.9' },
    run(v) {
      let lines = u.lines(v.x).filter((l) => l.trim());
      if (!lines.length) return null;
      if (v.q.trim()) {
        let re;
        try { re = new RegExp(v.q, 'i'); } catch (e) { throw new Error('Invalid regular expression: ' + e.message); }
        lines = lines.filter((l) => re.test(l));
      }
      const sev = {}, ips = {}, msg = {};
      for (const l of lines) {
        const s = (/\b(FATAL|CRIT(?:ICAL)?|ERROR|ERR|WARN(?:ING)?|NOTICE|INFO|DEBUG|TRACE)\b/i.exec(l) || [, 'none'])[1].toUpperCase();
        sev[s] = (sev[s] || 0) + 1;
        for (const ip of l.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || []) ips[ip] = (ips[ip] || 0) + 1;
        const n = l.replace(/^\S+\s+\S+\s+/, '').replace(/\b\d+(\.\d+)*\b/g, '#').trim();
        msg[n] = (msg[n] || 0) + 1;
      }
      const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
      return [
        { note: `${lines.length} lines analysed.`, tone: 'ok' },
        { title: 'By severity', table: { head: ['Level', 'Lines'], rows: top(sev, 10) } },
        Object.keys(ips).length ? { title: 'Top IP addresses', table: { head: ['Address', 'Lines'], rows: top(ips, 10) } } : null,
        { title: 'Most repeated messages', table: { head: ['Message', 'Lines'], rows: top(msg, 10) } },
      ];
    },
  });

  T({
    id: 'saml-decoder', name: 'SAML Decoder', cat: 'soc',
    tags: 'sso assertion base64 inflate federation entra okta adfs',
    fields: [{ k: 'x', type: 'area', label: 'Encoded value', rows: 7, ph: 'The SAMLRequest or SAMLResponse parameter' }],
    sample: { x: 'PHNhbWxwOlJlc3BvbnNlIHhtbG5zOnNhbWxwPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiIElEPSJfYWJjIj48c2FtbDpJc3N1ZXIgeG1sbnM6c2FtbD0idXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvbiI+aHR0cHM6Ly9pZHAuZXhhbXBsZS5jb208L3NhbWw6SXNzdWVyPjwvc2FtbHA6UmVzcG9uc2U+' },
    async run(v) {
      let s = v.x.trim();
      if (!s) return null;
      if (/^[\w%+/=.-]*%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s);
      s = s.replace(/^SAML(Request|Response)=/, '');
      const b = u.unb64(s);
      let xml = u.fromUtf8(b);
      if (!xml.trimStart().startsWith('<')) {
        const ds = new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        try { xml = u.fromUtf8(new Uint8Array(await new Response(ds).arrayBuffer())); } catch { throw new Error('That decoded to binary that is not valid DEFLATE.'); }
      }
      const pick = (re) => (re.exec(xml) || [])[1];
      const kv = [['Message', pick(/<(?:\w+:)?(\w*(?:Request|Response))\b/) || '-'], ['Issuer', pick(/Issuer[^>]*>([^<]+)</) || '-'], ['Subject', pick(/NameID[^>]*>([^<]+)</) || '-'], ['Not before', pick(/NotBefore="([^"]+)"/) || '-'], ['Not on or after', pick(/NotOnOrAfter="([^"]+)"/) || '-'], ['Audience', pick(/Audience[^>]*>([^<]+)</) || '-'], ['Status', pick(/StatusCode[^>]*Value="[^"]*:(\w+)"/) || '-']];
      return [{ kv: kv.filter((x) => x[1] !== '-') }, { title: 'XML', text: IT.fmtXml(xml), name: 'saml.xml' }];
    },
  });
})();
