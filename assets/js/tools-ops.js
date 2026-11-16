(function () {
  'use strict';
  const { tool: T, ref, u } = IT;
  const P = (s) => s.split('|');
  const table = (s) => s.trim().split('\n').map(P);

  // ---------- Time ----------
  T({
    id: 'unix-timestamp', name: 'Unix Timestamp Converter', cat: 'time', featured: true,
    tags: 'epoch time date posix convert log',
    fields: [{ k: 'x', type: 'text', label: 'Timestamp or date', ph: '1767225600 or 2026-01-01 00:00', mono: true }],
    sample: { x: '1767225600' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      let ms;
      if (/^-?\d+(\.\d+)?$/.test(s)) {
        const d = s.replace(/^-|\..*$/g, '').length, n = +s;
        ms = d <= 11 ? n * 1000 : d <= 14 ? n : d <= 17 ? n / 1e3 : n / 1e6;
      } else {
        ms = Date.parse(s);
        if (isNaN(ms)) throw new Error('That is neither a number nor a date I can read.');
      }
      const d = new Date(ms);
      return { kv: [['UTC', u.iso(d)], ['Local', d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })], ['Relative', u.ago(Date.now() - ms)], ['Seconds', String(Math.floor(ms / 1000))], ['Milliseconds', String(Math.floor(ms))], ['RFC 2822', d.toUTCString()]] };
    },
  });

  const ZONES = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'Africa/Johannesburg'];
  const fmtZ = (d, z) => new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
  const offsetMs = (d, z) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(d).map((x) => [x.type, +x.value]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
  };
  const offTxt = (ms) => { const m = Math.abs(ms) / 60000; return `UTC${ms < 0 ? '-' : '+'}${u.pad(Math.floor(m / 60))}:${u.pad(m % 60)}`; };
  IT.wallToUtc = (w, z) => {
    const guess = Date.parse(w + 'Z');
    if (isNaN(guess)) throw new Error('Enter a date and time.');
    let t = guess - offsetMs(new Date(guess), z);
    t = guess - offsetMs(new Date(t), z);
    return new Date(t);
  };
  T({
    id: 'timezone-converter', name: 'Time Zone Converter', cat: 'time', featured: true,
    tags: 'world utc dst maintenance window schedule',
    fields: [
      { k: 'w', type: 'datetime', label: 'Date and time', value: () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) },
      { k: 'z', type: 'select', label: 'In this zone', options: ZONES, value: 'UTC' },
    ],
    sample: { w: '2026-07-01T09:00', z: 'Europe/London' },
    run(v) {
      if (!v.w) return null;
      const t = IT.wallToUtc(v.w, v.z);
      return { table: { head: ['Zone', 'Local time', 'Offset'], rows: ZONES.map((z) => [z, fmtZ(t, z), offTxt(offsetMs(t, z))]) } };
    },
  });
  T({
    id: 'world-clock', name: 'World Clock', cat: 'time', tick: 1000,
    tags: 'time zones now current utc',
    fields: [], sample: {},
    run() {
      const d = new Date();
      return { table: { head: ['Zone', 'Now', 'Offset'], rows: ZONES.map((z) => [z, fmtZ(d, z), offTxt(offsetMs(d, z))]) } };
    },
  });
  T({
    id: 'date-calculator', name: 'Date Calculator', cat: 'time',
    tags: 'difference days between business working add',
    fields: [{ k: 'a', type: 'date', label: 'From', value: () => new Date().toISOString().slice(0, 10) }, { k: 'b', type: 'date', label: 'To' }, { k: 'add', type: 'num', label: 'Or add this many days to From', value: 90 }],
    sample: { a: '2026-01-01', b: '2026-03-01', add: 90 },
    run(v) {
      if (!v.a) return null;
      const A = Date.parse(v.a + 'T00:00Z');
      const out = [['From + ' + v.add + ' days', new Date(A + +v.add * 864e5).toUTCString().slice(0, 16)]];
      if (v.b) {
        const B = Date.parse(v.b + 'T00:00Z'), days = Math.round((B - A) / 864e5);
        let wd = 0;
        const step = days < 0 ? -1 : 1;
        if (Math.abs(days) < 40000) for (let i = 0; i < Math.abs(days); i++) { const dow = new Date(A + step * i * 864e5).getUTCDay(); if (dow !== 0 && dow !== 6) wd++; }
        out.unshift(['Calendar days', u.nf(days, 0)], ['Weekdays (excluding the end date)', u.nf(wd, 0)], ['Weeks', u.nf(days / 7, 1)], ['Hours', u.nf(days * 24, 0)]);
      }
      return { kv: out };
    },
  });
  T({
    id: 'duration-converter', name: 'Duration Converter', cat: 'time',
    tags: 'seconds uptime ttl hours minutes',
    fields: [{ k: 'x', type: 'text', label: 'Duration', ph: '86400 or 3d 4h 10m', mono: true }],
    sample: { x: '3d 4h 10m' },
    run(v) {
      const s = v.x.trim().toLowerCase();
      if (!s) return null;
      let sec;
      if (/^\d+(\.\d+)?$/.test(s)) sec = +s;
      else {
        sec = 0;
        const m = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(w|d|h|m|s)/g)];
        if (!m.length) throw new Error('Use a number of seconds, or units such as 2h 30m.');
        for (const [, n, x] of m) sec += +n * { w: 604800, d: 86400, h: 3600, m: 60, s: 1 }[x];
      }
      return { kv: [['Readable', u.fmtDur(sec)], ['Seconds', u.nf(sec, 0)], ['Minutes', u.nf(sec / 60)], ['Hours', u.nf(sec / 3600)], ['Days', u.nf(sec / 86400)], ['HH:MM:SS', `${u.pad(Math.floor(sec / 3600))}:${u.pad(Math.floor((sec % 3600) / 60))}:${u.pad(Math.floor(sec % 60))}`]] };
    },
  });
  T({
    id: 'excel-date', name: 'Excel Date Serial', cat: 'time',
    tags: 'spreadsheet serial number csv 1900',
    fields: [{ k: 'x', type: 'text', label: 'Serial number or date', ph: '46023 or 2026-01-01', mono: true }],
    sample: { x: '46023' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      const E = Date.UTC(1899, 11, 30);
      if (/^\d+(\.\d+)?$/.test(s)) return { kv: [['Date (UTC)', u.iso(new Date(E + +s * 864e5))]] };
      const t = Date.parse(s.length === 10 ? s + 'T00:00Z' : s);
      if (isNaN(t)) throw new Error('That is not a date.');
      return { kv: [['Serial', String((t - E) / 864e5)]] };
    },
  });

  // Cron
  const MON = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' '), DOW = 'SUN MON TUE WED THU FRI SAT'.split(' ');
  const LONGDOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ALIAS = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
  function cronField(s, lo, hi, names) {
    const set = new Set();
    const num = (x) => {
      const i = names ? names.indexOf(x.toUpperCase()) : -1;
      const n = i >= 0 ? i + (names === MON ? 1 : 0) : +x;
      if (!Number.isInteger(n)) throw new Error(`"${x}" is not valid in the cron field "${s}".`);
      return n;
    };
    for (const part of s.split(',')) {
      const m = /^(\*|[\w]+(?:-[\w]+)?)(?:\/(\d+))?$/.exec(part);
      if (!m) throw new Error(`Cannot read the cron field "${s}".`);
      let a = lo, b = hi;
      if (m[1] !== '*') {
        const r = m[1].split('-');
        a = num(r[0]);
        b = r[1] !== undefined ? num(r[1]) : m[2] ? hi : a;
      }
      const step = m[2] ? +m[2] : 1;
      if (!step) throw new Error('A cron step cannot be 0.');
      if (names === DOW && a === 7) a = 0;
      if (names === DOW && b === 7) { if (a === 0) { set.add(0); b = 0; } else { set.add(0); b = 6; } }
      if (a < lo || b > hi || a > b) throw new Error(`"${part}" is out of range (${lo} to ${hi}).`);
      for (let i = a; i <= b; i += step) set.add(i);
    }
    return { set, star: s === '*' || s.startsWith('*/') , raw: s };
  }
  IT.parseCron = function (expr) {
    let e = expr.trim();
    e = ALIAS[e.toLowerCase()] || e;
    const f = e.split(/\s+/);
    if (f.length !== 5) throw new Error('Cron needs 5 fields: minute hour day month weekday.');
    return { min: cronField(f[0], 0, 59), hour: cronField(f[1], 0, 23), dom: cronField(f[2], 1, 31), mon: cronField(f[3], 1, 12, MON), dow: cronField(f[4], 0, 7, DOW), f };
  };
  IT.cronNext = function (c, from, count) {
    const out = [];
    const d = new Date(from);
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    const limit = from.getTime() + 5 * 366 * 864e5;
    while (out.length < count && d.getTime() < limit) {
      const dayOk = (() => {
        const a = c.dom.set.has(d.getDate()), b = c.dow.set.has(d.getDay());
        if (c.dom.star && c.dow.star) return true;
        if (c.dom.star) return b;
        if (c.dow.star) return a;
        return a || b;
      })();
      if (!c.mon.set.has(d.getMonth() + 1) || !dayOk) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
      if (!c.hour.set.has(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
      if (!c.min.set.has(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1); continue; }
      out.push(new Date(d));
      d.setMinutes(d.getMinutes() + 1);
    }
    return out;
  };
  IT.cronExplain = function (c) {
    const [mi, h, dom, mon, dow] = c.f;
    const list = (set, m) => [...set].sort((a, b) => a - b).map(m).join(', ');
    let t;
    if (mi === '*' && h === '*') t = 'Every minute';
    else if (/^\*\/\d+$/.test(mi) && h === '*') t = `Every ${mi.slice(2)} minutes`;
    else if (/^\d+$/.test(mi) && h === '*') t = `Every hour at ${mi} minutes past`;
    else if (/^\d+$/.test(mi) && /^\d+$/.test(h)) t = `At ${u.pad(h)}:${u.pad(mi)}`;
    else if (/^\*\/\d+$/.test(h)) t = `Every ${h.slice(2)} hours at minute ${list(c.min.set, String)}`;
    else t = `At minute ${list(c.min.set, String)} of hour ${list(c.hour.set, String)}`;
    const q = [];
    if (dom !== '*') q.push(`on day ${list(c.dom.set, String)} of the month`);
    if (dow !== '*') q.push(`${dom !== '*' ? 'or ' : ''}on ${list(c.dow.set, (d) => LONGDOW[d])}`);
    if (mon !== '*') q.push(`in ${list(c.mon.set, (m) => MON[m - 1])}`);
    return [t, ...q].join(' ');
  };
  T({
    id: 'cron-explainer', name: 'Cron Explainer', cat: 'time', featured: true,
    tags: 'crontab schedule job linux next run',
    fields: [{ k: 'x', type: 'text', label: 'Cron expression', ph: '*/15 9-17 * * 1-5', mono: true }],
    sample: { x: '30 2 * * 1-5' },
    run(v) {
      if (!v.x.trim()) return null;
      const c = IT.parseCron(v.x);
      const n = IT.cronNext(c, new Date(), 8);
      return [{ big: IT.cronExplain(c), small: true }, { title: 'Next runs, in your local time', table: { head: ['#', 'When'], rows: n.map((d, i) => [i + 1, d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })]) } }];
    },
  });
  T({
    id: 'sla-calculator', name: 'SLA / Uptime Calculator', cat: 'time', featured: true,
    tags: 'nines availability downtime uptime 99.9',
    fields: [{ k: 'p', type: 'num', label: 'Availability target %', value: 99.9, min: 0, max: 100, step: 'any' }, { k: 'out', type: 'num', label: 'Downtime this month (minutes)', value: 0, min: 0, step: 'any' }],
    sample: { p: 99.95, out: 30 },
    run(v) {
      const down = 1 - v.p / 100, s = (d) => u.fmtDur(d * 86400 * down);
      const r = [['Per day', s(1)], ['Per week', s(7)], ['Per month (30 days)', s(30)], ['Per quarter (90 days)', s(90)], ['Per year (365 days)', s(365)]];
      const blocks = [{ table: { head: ['Period', 'Allowed downtime'], rows: r } }];
      if (+v.out > 0) {
        const got = 100 * (1 - v.out / (30 * 1440));
        blocks.unshift({ note: `${v.out} minutes down is ${u.nf(got, 3)}% for a 30-day month. ${got >= v.p ? 'Target met.' : 'Target missed.'}`, tone: got >= v.p ? 'ok' : 'bad' });
      }
      return blocks;
    },
  });
  T({ id: 'maintenance-timer', name: 'Countdown & Stopwatch', cat: 'time', tags: 'timer stopwatch countdown', custom: 'timer', fields: [] });

  // ---------- Windows & AD ----------
  const FT_EPOCH = 116444736000000000n;
  IT.filetime = (n) => new Date(Number((BigInt(n) - FT_EPOCH) / 10000n));
  T({
    id: 'ad-timestamp', name: 'AD / FILETIME Timestamp', cat: 'windows', featured: true,
    tags: 'ldap filetime lastlogon pwdlastset accountexpires 18-digit windows nt time',
    fields: [{ k: 'x', type: 'text', label: '18-digit value or a date', ph: '133800000000000000', mono: true }],
    sample: { x: '133800000000000000' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      if (/^\d+$/.test(s)) {
        const n = BigInt(s);
        if (n === 0n) return { note: 'Zero: never set. For pwdLastSet it means the user must change password at next logon.', tone: 'warn' };
        if (n >= 9223372036854775807n) return { note: 'Maximum value: never expires.', tone: 'ok' };
        const d = IT.filetime(n);
        return { kv: [['UTC', u.iso(d)], ['Local', d.toLocaleString()], ['Relative', u.ago(Date.now() - d.getTime())], ['Unix seconds', String(Math.floor(d.getTime() / 1000))]] };
      }
      const t = Date.parse(s);
      if (isNaN(t)) throw new Error('Enter an 18-digit value or a date.');
      return { kv: [['FILETIME / LDAP', (BigInt(t) * 10000n + FT_EPOCH).toString()]] };
    },
  });
  const UAC = [[1, 'SCRIPT', 'Logon script runs'], [2, 'ACCOUNTDISABLE', 'Account is disabled'], [8, 'HOMEDIR_REQUIRED', 'Home folder required'], [16, 'LOCKOUT', 'Locked out'], [32, 'PASSWD_NOTREQD', 'No password required'], [64, 'PASSWD_CANT_CHANGE', 'User cannot change password'], [128, 'ENCRYPTED_TEXT_PWD_ALLOWED', 'Reversible encryption allowed'], [256, 'TEMP_DUPLICATE_ACCOUNT', 'Local user account'], [512, 'NORMAL_ACCOUNT', 'Normal user account'], [2048, 'INTERDOMAIN_TRUST_ACCOUNT', 'Trust account'], [4096, 'WORKSTATION_TRUST_ACCOUNT', 'Computer account'], [8192, 'SERVER_TRUST_ACCOUNT', 'Domain controller'], [65536, 'DONT_EXPIRE_PASSWORD', 'Password never expires'], [131072, 'MNS_LOGON_ACCOUNT', 'MNS logon account'], [262144, 'SMARTCARD_REQUIRED', 'Smart card required'], [524288, 'TRUSTED_FOR_DELEGATION', 'Unconstrained delegation'], [1048576, 'NOT_DELEGATED', 'Cannot be delegated'], [2097152, 'USE_DES_KEY_ONLY', 'DES only'], [4194304, 'DONT_REQ_PREAUTH', 'No Kerberos pre-auth'], [8388608, 'PASSWORD_EXPIRED', 'Password expired'], [16777216, 'TRUSTED_TO_AUTH_FOR_DELEGATION', 'Protocol transition delegation'], [67108864, 'PARTIAL_SECRETS_ACCOUNT', 'Read-only domain controller']];
  const RISK = { 32: 1, 128: 1, 524288: 1, 2097152: 1, 4194304: 1 };
  T({
    id: 'uac-decoder', name: 'userAccountControl Decoder', cat: 'windows', featured: true,
    tags: 'active directory flags disabled delegation preauth attribute',
    fields: [{ k: 'x', type: 'text', label: 'userAccountControl value', ph: '66050', mono: true }],
    sample: { x: '4260352' },
    run(v) {
      if (!v.x.trim()) return null;
      const n = Number(v.x.trim());
      if (!Number.isInteger(n) || n < 0) throw new Error('Enter a whole number.');
      const hits = UAC.filter(([b]) => Math.floor(n / b) % 2 === 1);
      const left = hits.reduce((a, [b]) => a - b, n);
      const risky = hits.filter(([b]) => RISK[b]);
      return [risky.length ? { note: `Review: ${risky.map((r) => r[1]).join(', ')}`, tone: 'bad' } : null, { table: { head: ['Value', 'Flag', 'Meaning'], rows: hits.map(([b, f, d]) => [b, f, d]) } }, left ? { note: `${left} is left over and does not match a known flag.`, tone: 'warn' } : null];
    },
  });
  T({
    id: 'ad-group-type', name: 'AD groupType Decoder', cat: 'windows',
    tags: 'active directory global universal domain local security distribution',
    fields: [{ k: 'x', type: 'text', label: 'groupType value', ph: '-2147483646', mono: true }],
    sample: { x: '-2147483646' },
    run(v) {
      if (!v.x.trim()) return null;
      const n = Number(v.x.trim()) | 0;
      const scope = [[2, 'Global'], [4, 'Domain local'], [8, 'Universal']].filter(([b]) => n & b).map((x) => x[1]);
      return { kv: [['Scope', scope.join(', ') || 'Unknown'], ['Type', n & 0x80000000 ? 'Security' : 'Distribution'], ['System-created', n & 1 ? 'Yes' : 'No']] };
    },
  });
  T({
    id: 'kerberos-enctypes', name: 'Kerberos Encryption Types', cat: 'windows',
    tags: 'active directory aes rc4 des kerberoast etype attribute',
    fields: [{ k: 'x', type: 'text', label: 'msDS-SupportedEncryptionTypes value', ph: '28', mono: true }],
    sample: { x: '28' },
    run(v) {
      if (!v.x.trim()) return null;
      const n = +v.x;
      if (!Number.isInteger(n)) throw new Error('Enter a whole number.');
      const r = [[1, 'DES-CBC-CRC'], [2, 'DES-CBC-MD5'], [4, 'RC4-HMAC'], [8, 'AES128-CTS-HMAC-SHA1-96'], [16, 'AES256-CTS-HMAC-SHA1-96']].filter(([b]) => n & b);
      if (!n) return { note: 'Zero or unset: the domain default applies, which usually means RC4 for service tickets.', tone: 'warn' };
      const weak = n & 7;
      return [{ note: weak ? 'Includes legacy encryption (DES or RC4).' : 'AES only.', tone: weak ? 'warn' : 'ok' }, { table: { head: ['Bit', 'Encryption type'], rows: r } }];
    },
  });
  const WK = { 'S-1-0-0': 'Nobody', 'S-1-1-0': 'Everyone', 'S-1-2-0': 'Local', 'S-1-3-0': 'Creator Owner', 'S-1-5-7': 'Anonymous', 'S-1-5-9': 'Enterprise Domain Controllers', 'S-1-5-11': 'Authenticated Users', 'S-1-5-18': 'SYSTEM', 'S-1-5-19': 'LOCAL SERVICE', 'S-1-5-20': 'NETWORK SERVICE', 'S-1-5-32-544': 'BUILTIN\\Administrators', 'S-1-5-32-545': 'BUILTIN\\Users', 'S-1-5-32-546': 'BUILTIN\\Guests', 'S-1-5-32-547': 'BUILTIN\\Power Users', 'S-1-5-32-548': 'BUILTIN\\Account Operators', 'S-1-5-32-549': 'BUILTIN\\Server Operators', 'S-1-5-32-550': 'BUILTIN\\Print Operators', 'S-1-5-32-551': 'BUILTIN\\Backup Operators', 'S-1-5-32-555': 'BUILTIN\\Remote Desktop Users', 'S-1-5-32-562': 'BUILTIN\\Distributed COM Users', 'S-1-5-32-580': 'BUILTIN\\Remote Management Users' };
  const RID = { 500: 'Administrator', 501: 'Guest', 502: 'krbtgt', 512: 'Domain Admins', 513: 'Domain Users', 514: 'Domain Guests', 515: 'Domain Computers', 516: 'Domain Controllers', 517: 'Cert Publishers', 518: 'Schema Admins', 519: 'Enterprise Admins', 520: 'Group Policy Creator Owners', 525: 'Protected Users', 526: 'Key Admins', 527: 'Enterprise Key Admins' };
  IT.sidToBin = (s) => {
    const m = /^S-(\d+)-(\d+)((?:-\d+)*)$/i.exec(s.trim());
    if (!m) throw new Error('That is not a SID.');
    const sub = m[3] ? m[3].slice(1).split('-').map(Number) : [];
    const b = new Uint8Array(8 + sub.length * 4), dv = new DataView(b.buffer);
    b[0] = +m[1]; b[1] = sub.length;
    dv.setUint16(2, Math.floor(+m[2] / 2 ** 32)); dv.setUint32(4, +m[2] % 2 ** 32);
    sub.forEach((n, i) => dv.setUint32(8 + i * 4, n, true));
    return b;
  };
  IT.binToSid = (b) => {
    if (b.length < 8 || b.length !== 8 + b[1] * 4) throw new Error('That byte length does not fit a SID.');
    const dv = new DataView(b.buffer, b.byteOffset, b.length);
    const auth = dv.getUint16(2) * 2 ** 32 + dv.getUint32(4);
    const p = ['S', b[0], auth];
    for (let i = 0; i < b[1]; i++) p.push(dv.getUint32(8 + i * 4, true));
    return p.join('-');
  };
  T({
    id: 'sid-decoder', name: 'SID Decoder', cat: 'windows', featured: true,
    tags: 'security identifier objectsid active directory rid well known',
    fields: [{ k: 'x', type: 'text', label: 'SID, hex or Base64 objectSid', ph: 'S-1-5-21-…-512', mono: true }],
    sample: { x: 'S-1-5-21-3623811015-3361044348-30300820-512' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      const bin = /^S-/i.test(s) ? IT.sidToBin(s) : /^[0-9a-f\s\\x-]+$/i.test(s) && s.replace(/[^0-9a-f]/gi, '').length >= 16 ? u.unhex(s.replace(/\\x?/gi, '')) : u.unb64(s);
      const sid = IT.binToSid(bin), rid = sid.split('-').pop();
      const dom = /^S-1-5-21-\d+-\d+-\d+-(\d+)$/.test(sid);
      const name = WK[sid] || (dom ? RID[rid] || (+rid >= 1000 ? 'Normal user or group' : 'Unknown built-in') : 'Not a well-known SID');
      return { kv: [['SID', sid], ['Account', name], ...(dom ? [['Domain SID', sid.replace(/-\d+$/, '')], ['RID', rid]] : []), ['Hex', u.hex(bin)], ['Base64', u.b64(bin)], ['LDAP filter value', '\\' + u.hex(bin).match(/../g).join('\\')]] };
    },
  });
  T({
    id: 'guid-converter', name: 'AD GUID Converter', cat: 'windows',
    tags: 'objectguid octet string immutableid entra azure ad connect sourceanchor',
    fields: [{ k: 'x', type: 'text', label: 'GUID, Base64 ImmutableId or hex', mono: true }],
    sample: { x: '2c8a3f4e-1b7d-4a19-9c55-0f6e2d3a1b7c' },
    run(v) {
      const s = v.x.trim().replace(/[{}]/g, '');
      if (!s) return null;
      let raw;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
        const h = s.replace(/-/g, '');
        raw = new Uint8Array([...u.unhex(h.slice(0, 8)).reverse(), ...u.unhex(h.slice(8, 12)).reverse(), ...u.unhex(h.slice(12, 16)).reverse(), ...u.unhex(h.slice(16))]);
      } else if (/^[0-9a-f\s\\]{32,}$/i.test(s) && s.replace(/[\s\\]/g, '').length === 32) raw = u.unhex(s.replace(/\\/g, ''));
      else raw = u.unb64(s);
      if (raw.length !== 16) throw new Error('A GUID is exactly 16 bytes.');
      const h = u.hex(raw);
      const le = (x, y) => u.hex(u.unhex(h.slice(x, y)).reverse());
      const g = `${le(0, 8)}-${le(8, 12)}-${le(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
      return { kv: [['GUID', g], ['Base64 (ImmutableId)', u.b64(raw)], ['Octet string', h.toUpperCase()], ['LDAP filter', `(objectGUID=\\${h.match(/../g).join('\\')})`]] };
    },
  });
  const splitDN = (dn) => dn.match(/(?:[^,\\]|\\.)+/g).map((s) => s.trim());
  T({
    id: 'dn-parser', name: 'Distinguished Name Parser', cat: 'windows',
    tags: 'ldap ou cn dc canonical name active directory path',
    fields: [{ k: 'x', type: 'text', label: 'DN or canonical name', ph: 'CN=Jo Bloggs,OU=Staff,DC=corp,DC=example,DC=com', mono: true }],
    sample: { x: 'CN=Jo Bloggs,OU=London,OU=Staff,DC=corp,DC=example,DC=com' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      if (!/=/.test(s) && s.includes('/')) {
        const [dom, ...path] = s.split('/');
        const last = path.pop();
        return { kv: [['Distinguished name', [`CN=${last}`, ...path.reverse().map((p) => `OU=${p}`), ...dom.split('.').map((d) => `DC=${d}`)].join(',')]] };
      }
      const p = splitDN(s).map((x) => { const i = x.indexOf('='); if (i < 0) throw new Error(`"${x}" is not a key=value part.`); return [x.slice(0, i).toUpperCase(), x.slice(i + 1).replace(/\\(.)/g, '$1')]; });
      const dom = p.filter((x) => x[0] === 'DC').map((x) => x[1]).join('.');
      const rest = p.filter((x) => x[0] !== 'DC').map((x) => x[1]).reverse();
      return [{ kv: [['Canonical name', [dom, ...rest].join('/')], ['Domain', dom], ['Object', p[0][1]], ['Parent', splitDN(s).slice(1).join(',')]] }, { table: { head: ['Type', 'Value'], rows: p } }];
    },
  });
  T({
    id: 'ldap-filter', name: 'LDAP Filter Formatter', cat: 'windows',
    tags: 'query active directory search escape bitwise',
    fields: [{ k: 'x', type: 'area', label: 'Filter or value', rows: 4 }, { k: 'mode', type: 'seg', label: 'Mode', options: ['Format', 'Escape value'], value: 'Format' }],
    sample: { x: '(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(|(department=IT)(department=Ops)))' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      if (v.mode !== 'Format') return s.replace(/[\\*()\0]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
      let d = 0, o = '';
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(') {
          if (i) o += '\n' + '  '.repeat(d);
          o += c;
          d++;
        } else if (c === ')') {
          d--;
          if (d < 0) throw new Error('Too many closing brackets.');
          if (s[i - 1] === ')') o += '\n' + '  '.repeat(d);
          o += c;
        } else o += c;
      }
      if (d) throw new Error(`${d} bracket(s) are not closed.`);
      return o;
    },
  });
  T({
    id: 'username-generator', name: 'Bulk Username Generator', cat: 'windows',
    tags: 'onboarding samaccountname upn new starter naming convention',
    fields: [
      { k: 'x', type: 'area', label: 'Full names, one per line', rows: 6 },
      { k: 'pat', type: 'select', label: 'Pattern', options: [['f.last', 'j.smith'], ['first.last', 'john.smith'], ['flast', 'jsmith'], ['lastf', 'smithj'], ['firstl', 'johns']], value: 'first.last' },
      { k: 'dom', type: 'text', label: 'Email domain', value: 'example.com', mono: true },
      { k: 'max', type: 'num', label: 'Max length (20 for sAMAccountName)', value: 20, min: 4, max: 64 },
    ],
    sample: { x: 'John Smith\nJane Smith\nJohn Smith\nMaría O\'Neill-García' },
    run(v) {
      const names = u.lines(v.x).map((s) => s.trim()).filter(Boolean);
      if (!names.length) return null;
      const seen = {};
      const ascii = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
      const rows = names.map((n) => {
        const p = n.split(/\s+/), f = ascii(p[0]), l = ascii(p.slice(1).join('')) || f;
        const b = { 'f.last': `${f[0]}.${l}`, 'first.last': `${f}.${l}`, flast: f[0] + l, lastf: l + f[0], firstl: f + l[0] }[v.pat].slice(0, +v.max);
        seen[b] = (seen[b] || 0) + 1;
        const un = seen[b] > 1 ? b.slice(0, +v.max - String(seen[b]).length) + seen[b] : b;
        return [n, un, `${un}@${v.dom.trim()}`];
      });
      return { table: { head: ['Name', 'Username', 'Email'], rows } };
    },
  });
  const WINERR = table(`
0|ERROR_SUCCESS|The operation completed successfully
2|ERROR_FILE_NOT_FOUND|The file could not be found
3|ERROR_PATH_NOT_FOUND|The path could not be found
5|ERROR_ACCESS_DENIED|Access is denied
6|ERROR_INVALID_HANDLE|The handle is invalid
32|ERROR_SHARING_VIOLATION|The file is in use by another process
53|ERROR_BAD_NETPATH|The network path was not found
64|ERROR_NETNAME_DELETED|The network name is no longer available
67|ERROR_BAD_NET_NAME|The network name cannot be found
86|ERROR_INVALID_PASSWORD|The network password is incorrect
87|ERROR_INVALID_PARAMETER|The parameter is incorrect
112|ERROR_DISK_FULL|There is not enough space on the disk
1053|ERROR_SERVICE_REQUEST_TIMEOUT|The service did not respond in time
1058|ERROR_SERVICE_DISABLED|The service is disabled
1060|ERROR_SERVICE_DOES_NOT_EXIST|The service is not installed
1061|ERROR_SERVICE_CANNOT_ACCEPT_CTRL|The service cannot accept control messages now
1062|ERROR_SERVICE_NOT_ACTIVE|The service has not been started
1067|ERROR_PROCESS_ABORTED|The process terminated unexpectedly
1069|ERROR_SERVICE_LOGON_FAILED|The service failed to log on
1203|ERROR_NO_NET_OR_BAD_PATH|No network provider accepted the path
1219|ERROR_SESSION_CREDENTIAL_CONFLICT|Multiple connections to a server with different credentials
1231|ERROR_NETWORK_UNREACHABLE|The network location cannot be reached
1326|ERROR_LOGON_FAILURE|Unknown user name or bad password
1327|ERROR_ACCOUNT_RESTRICTION|Account restrictions are preventing sign in
1328|ERROR_INVALID_LOGON_HOURS|Outside of allowed logon hours
1329|ERROR_INVALID_WORKSTATION|Not allowed to log on to this computer
1330|ERROR_PASSWORD_EXPIRED|The password has expired
1331|ERROR_ACCOUNT_DISABLED|The account is disabled
1385|ERROR_LOGON_TYPE_NOT_GRANTED|The requested logon type has not been granted
1396|ERROR_WRONG_TARGET_NAME|The target account name is incorrect, often an SPN problem
1603|ERROR_INSTALL_FAILURE|Fatal error during MSI installation
1618|ERROR_INSTALL_ALREADY_RUNNING|Another installation is in progress
1619|ERROR_INSTALL_PACKAGE_OPEN_FAILED|The installation package could not be opened
1641|ERROR_SUCCESS_REBOOT_INITIATED|The installer has started a restart
1722|RPC_S_SERVER_UNAVAILABLE|The RPC server is unavailable
1726|RPC_S_CALL_FAILED|The remote procedure call failed
1753|EPT_S_NOT_REGISTERED|No more endpoints are available
1907|ERROR_PASSWORD_MUST_CHANGE|The password must be changed before signing in
1909|ERROR_ACCOUNT_LOCKED_OUT|The account is locked out
3010|ERROR_SUCCESS_REBOOT_REQUIRED|Succeeded, but a restart is required
0x80004001|E_NOTIMPL|Not implemented
0x80004005|E_FAIL|Unspecified error
0x8000FFFF|E_UNEXPECTED|Catastrophic failure
0x8007000E|E_OUTOFMEMORY|Out of memory
0x80072EE2|ERROR_INTERNET_TIMEOUT|The connection timed out
0x80072EE7|ERROR_INTERNET_NAME_NOT_RESOLVED|The server name could not be resolved
0x80072EFD|ERROR_INTERNET_CANNOT_CONNECT|The connection could not be established
0x80072F8F|ERROR_INTERNET_SECURE_FAILURE|TLS failure, check the clock and root certificates
0x8024402C|WU_E_PT_WINHTTP_NAME_NOT_RESOLVED|Windows Update could not resolve its server name
0x800F081F|CBS_E_SOURCE_MISSING|Component source files could not be found
0xC0000005|STATUS_ACCESS_VIOLATION|Invalid memory access
0xC0000022|STATUS_ACCESS_DENIED|Access denied
0xC0000064|STATUS_NO_SUCH_USER|The user does not exist
0xC000006A|STATUS_WRONG_PASSWORD|The user exists but the password is wrong
0xC000006D|STATUS_LOGON_FAILURE|Bad user name or password
0xC000006F|STATUS_INVALID_LOGON_HOURS|Outside of allowed hours
0xC0000070|STATUS_INVALID_WORKSTATION|Workstation restriction
0xC0000071|STATUS_PASSWORD_EXPIRED|The password has expired
0xC0000072|STATUS_ACCOUNT_DISABLED|The account is disabled
0xC000007B|STATUS_INVALID_IMAGE_FORMAT|Bad image, often a 32 and 64-bit mismatch
0xC00000FD|STATUS_STACK_OVERFLOW|Stack overflow
0xC0000133|STATUS_TIME_DIFFERENCE_AT_DC|Clock skew with the domain controller
0xC0000135|STATUS_DLL_NOT_FOUND|A required DLL was not found
0xC0000142|STATUS_DLL_INIT_FAILED|A DLL failed to initialise
0xC000015B|STATUS_LOGON_TYPE_NOT_GRANTED|The logon type has not been granted
0xC0000193|STATUS_ACCOUNT_EXPIRED|The account has expired
0xC0000224|STATUS_PASSWORD_MUST_CHANGE|The password must be changed at next logon
0xC0000234|STATUS_ACCOUNT_LOCKED_OUT|The account is locked out
0xC0000374|STATUS_HEAP_CORRUPTION|Heap corruption
0xC0000409|STATUS_STACK_BUFFER_OVERRUN|Stack buffer overrun`);
  const FAC = { 0: 'Null', 1: 'RPC', 2: 'Dispatch', 3: 'Storage', 4: 'ITF', 7: 'Win32', 8: 'Windows', 9: 'Security', 10: 'Control', 11: 'Certificates', 12: 'WinINet', 13: 'MediaServer', 15: 'SetupAPI', 36: 'Windows Update' };
  T({
    id: 'windows-error-lookup', name: 'Windows Error Lookup', cat: 'windows', featured: true,
    tags: 'hresult ntstatus 0x80070005 system error code exit msi',
    fields: [{ k: 'x', type: 'text', label: 'Error code', ph: '0x80070005, 1326 or -2147024891', mono: true }],
    sample: { x: '0x80070005' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      const n0 = /^(0x|[0-9a-f]*[a-f][0-9a-f]*$)/i.test(s) ? parseInt(s.replace(/^0x/i, ''), 16) : Number(s);
      if (!Number.isFinite(n0)) throw new Error('Enter a decimal or hex number.');
      const n = n0 < 0 ? n0 + 2 ** 32 : n0;
      const hex = '0x' + n.toString(16).toUpperCase().padStart(8, '0');
      const find = (x) => WINERR.find((r) => (r[0].startsWith('0x') ? parseInt(r[0], 16) : +r[0]) === x);
      let row = find(n);
      const kv = [['Hex', hex], ['Decimal', String(n)]];
      if (n >= 2 ** 31) {
        const fac = Math.floor(n / 65536) & 0x7ff, code = n % 65536, top = n >>> 30;
        if (top === 3) kv.push(['Kind', 'NTSTATUS error'], ['Facility', String(fac)]);
        else {
          kv.push(['Kind', 'HRESULT failure'], ['Facility', FAC[fac] || String(fac)], ['Code', String(code)]);
          if (!row && fac === 7) row = find(code);
        }
      } else kv.push(['Kind', 'Win32 error']);
      return [row ? { big: row[2], small: true } : { note: 'Not in the built-in list. Run: certutil -error ' + hex, tone: 'warn' }, { kv: row ? [['Symbol', row[1]], ...kv] : kv }];
    },
  });
  ref({
    id: 'event-ids', name: 'Windows Event ID Reference', cat: 'windows', featured: true,
    tags: 'security log audit 4624 4625 4740 sysmon lockout logon',
    ph: '4625, lockout, service…',
    head: ['ID', 'Log', 'Meaning'],
    rows: table(`
1102|Security|The audit log was cleared
4624|Security|Successful logon
4625|Security|Failed logon
4634|Security|Logoff
4647|Security|User-initiated logoff
4648|Security|Logon with explicit credentials (runas)
4656|Security|Handle to an object was requested
4663|Security|Attempt to access an object
4670|Security|Permissions on an object changed
4672|Security|Special privileges assigned to a new logon
4688|Security|New process created
4689|Security|Process exited
4697|Security|Service installed
4698|Security|Scheduled task created
4699|Security|Scheduled task deleted
4700|Security|Scheduled task enabled
4701|Security|Scheduled task disabled
4702|Security|Scheduled task updated
4719|Security|Audit policy changed
4720|Security|User account created
4722|Security|User account enabled
4723|Security|User tried to change own password
4724|Security|Password reset attempt
4725|Security|User account disabled
4726|Security|User account deleted
4727|Security|Global security group created
4728|Security|Member added to global group
4729|Security|Member removed from global group
4732|Security|Member added to local group
4733|Security|Member removed from local group
4738|Security|User account changed
4740|Security|Account locked out
4741|Security|Computer account created
4742|Security|Computer account changed
4743|Security|Computer account deleted
4756|Security|Member added to universal group
4757|Security|Member removed from universal group
4767|Security|Account unlocked
4768|Security|Kerberos TGT requested
4769|Security|Kerberos service ticket requested
4771|Security|Kerberos pre-authentication failed
4776|Security|NTLM credential validation
4778|Security|RDP session reconnected
4779|Security|RDP session disconnected
4798|Security|User's local group membership enumerated
4799|Security|Local group membership enumerated
4946|Security|Firewall rule added
5136|Security|Directory object modified
5140|Security|Network share accessed
5145|Security|Share object access checked
5156|Security|Network connection allowed by firewall
41|System|Kernel-Power: rebooted without a clean shutdown
104|System|An event log was cleared
1074|System|Shutdown or restart initiated by a process or user
6005|System|Event Log service started (boot)
6006|System|Event Log service stopped (clean shutdown)
6008|System|Previous shutdown was unexpected
7034|System|Service crashed
7036|System|Service changed state
7040|System|Service start type changed
7045|System|New service installed
1000|Application|Application crash
1002|Application|Application hang
4103|PowerShell|Module logging
4104|PowerShell|Script block logging
1|Sysmon|Process created
3|Sysmon|Network connection
11|Sysmon|File created
13|Sysmon|Registry value set
22|Sysmon|DNS query`),
  });
  ref({
    id: 'logon-types', name: 'Logon Type Reference', cat: 'windows',
    tags: 'interactive network batch service rdp 4624',
    head: ['Type', 'Name', 'Example'],
    rows: table(`
2|Interactive|At the keyboard
3|Network|SMB share, or a remote WMI call
4|Batch|Scheduled task
5|Service|A service starting under an account
7|Unlock|Workstation unlocked
8|NetworkCleartext|Credentials sent in clear, such as IIS Basic
9|NewCredentials|runas /netonly
10|RemoteInteractive|Remote Desktop
11|CachedInteractive|Laptop away from the DC
12|CachedRemoteInteractive|RDP with cached credentials
13|CachedUnlock|Unlock with cached credentials`),
  });
  ref({
    id: 'bsod-codes', name: 'BSOD Stop Codes', cat: 'windows',
    tags: 'blue screen crash bugcheck minidump stop',
    head: ['Code', 'Name', 'Usual suspect'],
    rows: table(`
0x0000000A|IRQL_NOT_LESS_OR_EQUAL|Driver or faulty RAM
0x0000001A|MEMORY_MANAGEMENT|RAM or storage driver
0x0000001E|KMODE_EXCEPTION_NOT_HANDLED|Driver
0x00000024|NTFS_FILE_SYSTEM|Disk corruption, run chkdsk
0x0000003B|SYSTEM_SERVICE_EXCEPTION|Driver, often graphics or antivirus
0x0000004E|PFN_LIST_CORRUPT|RAM or driver
0x00000050|PAGE_FAULT_IN_NONPAGED_AREA|RAM, driver or antivirus
0x0000007A|KERNEL_DATA_INPAGE_ERROR|Failing disk or cable
0x0000007B|INACCESSIBLE_BOOT_DEVICE|Storage driver or changed disk mode
0x0000007E|SYSTEM_THREAD_EXCEPTION_NOT_HANDLED|Driver
0x0000007F|UNEXPECTED_KERNEL_MODE_TRAP|Hardware, overheating or overclock
0x0000009F|DRIVER_POWER_STATE_FAILURE|Driver during sleep or resume
0x000000BE|ATTEMPTED_WRITE_TO_READONLY_MEMORY|Driver
0x000000C2|BAD_POOL_CALLER|Driver
0x000000C4|DRIVER_VERIFIER_DETECTED_VIOLATION|Driver Verifier caught a driver
0x000000D1|DRIVER_IRQL_NOT_LESS_OR_EQUAL|Network, storage or antivirus driver
0x000000EA|THREAD_STUCK_IN_DEVICE_DRIVER|Graphics driver or card
0x000000ED|UNMOUNTABLE_BOOT_VOLUME|Disk or file system
0x000000EF|CRITICAL_PROCESS_DIED|System files or disk, run sfc and DISM
0x000000F4|CRITICAL_OBJECT_TERMINATION|Failing storage
0x000000FC|ATTEMPTED_EXECUTE_OF_NOEXECUTE_MEMORY|Driver or RAM
0x00000101|CLOCK_WATCHDOG_TIMEOUT|CPU, BIOS or overclock
0x00000109|CRITICAL_STRUCTURE_CORRUPTION|Driver or hardware
0x00000116|VIDEO_TDR_FAILURE|Graphics driver or card
0x00000117|VIDEO_TDR_TIMEOUT_DETECTED|Graphics driver or card
0x00000124|WHEA_UNCORRECTABLE_ERROR|CPU, RAM, power or heat
0x00000133|DPC_WATCHDOG_VIOLATION|Storage driver or SSD firmware
0x00000139|KERNEL_SECURITY_CHECK_FAILURE|Driver or corruption
0x0000013A|KERNEL_MODE_HEAP_CORRUPTION|Driver
0x00000154|UNEXPECTED_STORE_EXCEPTION|Storage or antivirus`),
  });
  ref({
    id: 'run-commands', name: 'Windows Run Commands', cat: 'windows',
    tags: 'msc cpl control panel console shortcut win+r',
    head: ['Command', 'Opens'],
    rows: table(`
appwiz.cpl|Programs and Features
certlm.msc|Certificates, local machine
certmgr.msc|Certificates, current user
cleanmgr|Disk Cleanup
compmgmt.msc|Computer Management
control printers|Devices and Printers
control userpasswords2|User Accounts (netplwiz)
devmgmt.msc|Device Manager
diskmgmt.msc|Disk Management
dsa.msc|Active Directory Users and Computers
dssite.msc|Active Directory Sites and Services
domain.msc|Active Directory Domains and Trusts
dnsmgmt.msc|DNS Manager
dhcpmgmt.msc|DHCP Manager
eventvwr.msc|Event Viewer
fsmgmt.msc|Shared Folders
firewall.cpl|Windows Firewall
gpedit.msc|Local Group Policy Editor
gpmc.msc|Group Policy Management
inetcpl.cpl|Internet Options
lusrmgr.msc|Local Users and Groups
mmsys.cpl|Sound
msconfig|System Configuration
msinfo32|System Information
mstsc|Remote Desktop
ncpa.cpl|Network Connections
perfmon|Performance Monitor
powercfg.cpl|Power Options
printmanagement.msc|Print Management
regedit|Registry Editor
resmon|Resource Monitor
rsop.msc|Resultant Set of Policy
secpol.msc|Local Security Policy
services.msc|Services
shell:startup|Startup folder
shell:common startup|All Users startup folder
sysdm.cpl|System Properties
taskschd.msc|Task Scheduler
timedate.cpl|Date and Time
wf.msc|Firewall with Advanced Security
wmimgmt.msc|WMI Control`),
  });
  ref({
    id: 'powershell-cheatsheet', name: 'PowerShell Cheat Sheet', cat: 'windows',
    tags: 'commands ad module get-aduser script',
    head: ['Task', 'Command'],
    rows: table(`
Find locked out accounts|Search-ADAccount -LockedOut
Unlock a user|Unlock-ADAccount -Identity jsmith
Reset a password|Set-ADAccountPassword jsmith -Reset
Show group members|Get-ADGroupMember "Domain Admins" -Recursive
Show a user's groups|Get-ADPrincipalGroupMembership jsmith
Inactive users, 90 days|Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly
Accounts with expired passwords|Search-ADAccount -PasswordExpired
Domain controllers|Get-ADDomainController -Filter *
FSMO role holders|netdom query fsmo
AD replication status|repadmin /replsummary
Force a GPO update|gpupdate /force
GPO report|gpresult /h C:\\Temp\\gp.html
Last boot time|(Get-CimInstance Win32_OperatingSystem).LastBootUpTime
Disk free space|Get-Volume
Top CPU processes|Get-Process | Sort-Object CPU -Descending | Select-Object -First 10
Stopped automatic services|Get-Service | Where-Object {$_.StartType -eq 'Automatic' -and $_.Status -ne 'Running'}
Installed updates|Get-HotFix | Sort-Object InstalledOn -Descending
Installed programs|Get-Package
Check a TCP port|Test-NetConnection server -Port 443
Open connections|Get-NetTCPConnection -State Established
Flush DNS|Clear-DnsClientCache
Recent system errors|Get-WinEvent -LogName System -MaxEvents 50 | Where-Object Level -le 2
Failed logons|Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625} -MaxEvents 20
Find large files|Get-ChildItem C:\\ -Recurse -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 20 FullName,Length
System file repair|sfc /scannow; DISM /Online /Cleanup-Image /RestoreHealth
Run on many servers|Invoke-Command -ComputerName s1,s2 -ScriptBlock { hostname }
Export to CSV|Get-Process | Export-Csv C:\\Temp\\out.csv -NoTypeInformation`),
  });
  T({
    id: 'robocopy-builder', name: 'Robocopy Builder', cat: 'windows',
    tags: 'copy migrate mirror file server sync',
    fields: [
      { k: 'src', type: 'text', label: 'Source', value: 'D:\\Shares\\Finance', mono: true },
      { k: 'dst', type: 'text', label: 'Destination', value: '\\\\fs02\\Finance', mono: true },
      { k: 'mode', type: 'select', label: 'Mode', options: [['e', 'Copy all, including subfolders'], ['mir', 'Mirror (deletes extras at destination)'], ['mov', 'Move files']], value: 'e' },
      { k: 'sec', type: 'check', label: 'Keep NTFS permissions', value: true },
      { k: 'mt', type: 'num', label: 'Threads (/MT)', value: 16, min: 1, max: 128 },
      { k: 'r', type: 'num', label: 'Retries', value: 2, min: 0 },
      { k: 'w', type: 'num', label: 'Wait seconds', value: 5, min: 0 },
      { k: 'log', type: 'text', label: 'Log file', value: 'C:\\Temp\\robocopy.log', mono: true },
      { k: 'l', type: 'check', label: 'Dry run (/L)' },
    ],
    sample: {},
    run(v) {
      const a = ['robocopy', `"${v.src}"`, `"${v.dst}"`, { e: '/E', mir: '/MIR', mov: '/E /MOVE' }[v.mode]];
      a.push(v.sec ? '/COPYALL' : '/COPY:DAT', '/DCOPY:DAT', `/MT:${v.mt}`, `/R:${v.r}`, `/W:${v.w}`, '/NP', '/TEE');
      if (v.log) a.push(`/LOG:"${v.log}"`);
      if (v.l) a.push('/L');
      return [v.mode === 'mir' ? { note: '/MIR deletes destination files that are not in the source. Test with /L first.', tone: 'warn' } : null, { text: a.join(' ') }];
    },
  });
  T({
    id: 'schtasks-builder', name: 'Scheduled Task Builder', cat: 'windows',
    tags: 'task scheduler windows cron powershell',
    fields: [
      { k: 'n', type: 'text', label: 'Task name', value: 'IT\\NightlyCleanup' },
      { k: 'cmd', type: 'text', label: 'PowerShell script', value: 'C:\\Scripts\\cleanup.ps1', mono: true },
      { k: 's', type: 'select', label: 'Schedule', options: ['DAILY', 'WEEKLY', 'MONTHLY', 'ONSTART', 'ONLOGON'], value: 'DAILY' },
      { k: 't', type: 'text', label: 'Start time', value: '02:30', mono: true, show: (v) => /DAILY|WEEKLY|MONTHLY/.test(v.s) },
      { k: 'd', type: 'text', label: 'Day (MON or 1)', value: 'SUN', mono: true, show: (v) => /WEEKLY|MONTHLY/.test(v.s) },
      { k: 'u', type: 'select', label: 'Run as', options: ['SYSTEM', 'NETWORK SERVICE'], value: 'SYSTEM' },
    ],
    sample: {},
    run(v) {
      const a = ['schtasks /Create', `/TN "${v.n}"`, `/TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \\"${v.cmd}\\""`, `/SC ${v.s}`];
      if (/DAILY|WEEKLY|MONTHLY/.test(v.s)) a.push(`/ST ${v.t}`);
      if (/WEEKLY|MONTHLY/.test(v.s)) a.push(`/D ${v.d}`);
      a.push(`/RU "${v.u}"`, '/RL HIGHEST', '/F');
      return a.join(' ');
    },
  });
  T({
    id: 'windows-firewall', name: 'Windows Firewall Rule Builder', cat: 'windows',
    tags: 'netsh inbound outbound allow block port',
    fields: [
      { k: 'n', type: 'text', label: 'Rule name', value: 'Allow HTTPS' },
      { k: 'dir', type: 'seg', label: 'Direction', options: ['Inbound', 'Outbound'], value: 'Inbound' },
      { k: 'act', type: 'seg', label: 'Action', options: ['Allow', 'Block'], value: 'Allow' },
      { k: 'pr', type: 'seg', label: 'Protocol', options: ['TCP', 'UDP'], value: 'TCP' },
      { k: 'p', type: 'text', label: 'Ports', value: '443', mono: true },
      { k: 'r', type: 'text', label: 'Remote address', value: 'Any', mono: true },
    ],
    sample: {},
    run(v) {
      const n = v.n.replace(/"/g, '');
      return [{ title: 'PowerShell', text: `New-NetFirewallRule -DisplayName "${n}" -Direction ${v.dir} -Action ${v.act} -Protocol ${v.pr} -LocalPort ${v.p} -RemoteAddress ${v.r}` }, { title: 'netsh', text: `netsh advfirewall firewall add rule name="${n}" dir=${v.dir === 'Inbound' ? 'in' : 'out'} action=${v.act.toLowerCase()} protocol=${v.pr} localport=${v.p} remoteip=${v.r.toLowerCase()}` }];
    },
  });

  // ---------- Linux & Servers ----------
  const rwx = (d) => (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-') + (d & 1 ? 'x' : '-');
  T({
    id: 'chmod-calculator', name: 'chmod Calculator', cat: 'linux', featured: true,
    tags: 'permissions linux unix file mode rwx',
    fields: [{ k: 'x', type: 'text', label: 'Mode', ph: '755, 2775 or rwxr-xr-x', mono: true }],
    sample: { x: '2775' },
    run(v) {
      let s = v.x.trim();
      if (!s) return null;
      let oct;
      if (/^[0-7]{3,4}$/.test(s)) oct = s.padStart(4, '0');
      else {
        s = s.replace(/^[-dl]?(?=.{9}$)/, '');
        if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(s)) throw new Error('Use octal such as 644, or nine characters such as rw-r--r--.');
        const grp = (i) => (s[i] === 'r' ? 4 : 0) + (s[i + 1] === 'w' ? 2 : 0) + (/[xst]/.test(s[i + 2]) ? 1 : 0);
        const sp = (/s/i.test(s[2]) ? 4 : 0) + (/s/i.test(s[5]) ? 2 : 0) + (/t/i.test(s[8]) ? 1 : 0);
        oct = `${sp}${grp(0)}${grp(3)}${grp(6)}`;
      }
      const [sp, a, b, c] = [...oct].map(Number);
      let sym = rwx(a) + rwx(b) + rwx(c);
      const put = (i, ch) => { const o = sym[i]; sym = sym.slice(0, i) + (o === 'x' ? ch : ch.toUpperCase()) + sym.slice(i + 1); };
      if (sp & 4) put(2, 's');
      if (sp & 2) put(5, 's');
      if (sp & 1) put(8, 't');
      const who = (d) => [d & 4 && 'read', d & 2 && 'write', d & 1 && 'execute'].filter(Boolean).join(', ') || 'none';
      const warn = c & 2 ? { note: 'Anyone on the system can write to this.', tone: 'bad' } : null;
      return [warn, { kv: [['Octal', oct.replace(/^0/, '')], ['Symbolic', sym], ['Owner', who(a)], ['Group', who(b)], ['Others', who(c)], ['Special', [sp & 4 && 'setuid', sp & 2 && 'setgid', sp & 1 && 'sticky'].filter(Boolean).join(', ') || 'none'], ['Command', `chmod ${oct.replace(/^0/, '')} file`]] }];
    },
  });
  T({
    id: 'umask-calculator', name: 'umask Calculator', cat: 'linux',
    tags: 'permissions default file directory',
    fields: [{ k: 'x', type: 'text', label: 'umask', value: '022', mono: true }],
    sample: { x: '027' },
    run(v) {
      if (!/^[0-7]{3,4}$/.test(v.x.trim())) throw new Error('A umask is 3 or 4 octal digits.');
      const m = parseInt(v.x, 8);
      const f = (0o666 & ~m).toString(8).padStart(3, '0'), d = (0o777 & ~m).toString(8).padStart(3, '0');
      const s = (o) => [...o].map((c) => rwx(+c)).join('');
      return { kv: [['New files', `${f}  ${s(f)}`], ['New directories', `${d}  ${s(d)}`]] };
    },
  });
  // Tokenise a shell command, honouring quotes and backslash continuations.
  IT.shellSplit = (s) => (s.replace(/\\\r?\n/g, ' ').match(/(?:[^\s"']+|"(?:[^"\\]|\\.)*"|'[^']*')+/g) || []).map((t) => t.replace(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g, (_, a, b) => (a !== undefined ? a.replace(/\\(.)/g, '$1') : b)));
  IT.dockerRunToCompose = function (cmd) {
    const t = IT.shellSplit(cmd.trim());
    let i = t.findIndex((x) => x === 'run');
    if (i < 0) throw new Error('This needs to be a docker run command.');
    i++;
    const s = {};
    let name = 'app';
    const arr = (k, v) => (s[k] = s[k] || []).push(v);
    const withV = { '-p': 'ports', '--publish': 'ports', '-v': 'volumes', '--volume': 'volumes', '-e': 'environment', '--env': 'environment', '--env-file': 'env_file', '--cap-add': 'cap_add', '--cap-drop': 'cap_drop', '--dns': 'dns', '-l': 'labels', '--label': 'labels', '--add-host': 'extra_hosts', '--device': 'devices' };
    const one = { '--restart': 'restart', '--hostname': 'hostname', '-h': 'hostname', '-u': 'user', '--user': 'user', '-w': 'working_dir', '--workdir': 'working_dir', '--entrypoint': 'entrypoint', '--network': 'network_mode', '--net': 'network_mode', '--memory': 'mem_limit', '-m': 'mem_limit', '--cpus': 'cpus' };
    for (; i < t.length; i++) {
      let a = t[i], val;
      if (!a.startsWith('-')) break;
      const eq = a.startsWith('--') ? a.indexOf('=') : -1;
      if (eq > 0) { val = a.slice(eq + 1); a = a.slice(0, eq); }
      if (a === '--name') name = val || t[++i];
      else if (withV[a]) arr(withV[a], val !== undefined ? val : t[++i]);
      else if (one[a]) s[one[a]] = val !== undefined ? val : t[++i];
      else if (a === '--privileged') s.privileged = true;
      else if (/^-[dit]+$/.test(a) || a === '--detach' || a === '--rm' || a === '--interactive' || a === '--tty' || a === '--init') { if (/t/.test(a)) s.tty = true; }
      else throw new Error(`The flag ${a} is not handled. Remove it and add it to the Compose file by hand.`);
    }
    if (!t[i]) throw new Error('No image found in that command.');
    const svc = { image: t[i], ...s };
    if (t.length > i + 1) svc.command = t.slice(i + 1);
    if (s.cpus) svc.cpus = +s.cpus;
    return { services: { [name]: svc } };
  };
  T({
    id: 'docker-compose', name: 'docker run to Compose', cat: 'linux', featured: true,
    tags: 'container yaml convert compose service',
    fields: [{ k: 'x', type: 'area', label: 'docker run command', rows: 6 }],
    sample: { x: 'docker run -d --name uptime --restart unless-stopped -p 3001:3001 \\\n  -v uptime-data:/app/data -e TZ="Europe/London" louislam/uptime-kuma:1' },
    run(v) {
      if (!v.x.trim()) return null;
      return { text: jsyaml.dump(IT.dockerRunToCompose(v.x), { lineWidth: -1 }), name: 'compose.yaml' }; // eslint-disable-line no-undef
    },
  });
  T({
    id: 'systemd-unit', name: 'systemd Unit Generator', cat: 'linux',
    tags: 'service daemon linux unit file',
    fields: [
      { k: 'n', type: 'text', label: 'Service name', value: 'myapp', mono: true },
      { k: 'd', type: 'text', label: 'Description', value: 'My application' },
      { k: 'cmd', type: 'text', label: 'ExecStart', value: '/opt/myapp/bin/server --port 8080', mono: true },
      { k: 'usr', type: 'text', label: 'Run as user', value: 'myapp', mono: true },
      { k: 'wd', type: 'text', label: 'Working directory', value: '/opt/myapp', mono: true },
      { k: 'r', type: 'select', label: 'Restart', options: ['on-failure', 'always', 'no'], value: 'on-failure' },
      { k: 'h', type: 'check', label: 'Add sandboxing options', value: true },
    ],
    sample: {},
    run(v) {
      const h = v.h ? '\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=full\nProtectHome=true' : '';
      return [{ title: `/etc/systemd/system/${v.n}.service`, text: `[Unit]\nDescription=${v.d}\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nUser=${v.usr}\nWorkingDirectory=${v.wd}\nExecStart=${v.cmd}\nRestart=${v.r}\nRestartSec=5${h}\n\n[Install]\nWantedBy=multi-user.target`, name: `${v.n}.service` }, { title: 'Install', text: `sudo systemctl daemon-reload\nsudo systemctl enable --now ${v.n}\nsystemctl status ${v.n}\njournalctl -u ${v.n} -f` }];
    },
  });
  T({
    id: 'nginx-proxy', name: 'Nginx Reverse Proxy Config', cat: 'linux',
    tags: 'web server tls https proxy_pass config letsencrypt',
    fields: [
      { k: 'h', type: 'text', label: 'Server name', value: 'app.example.com', mono: true },
      { k: 'u', type: 'text', label: 'Upstream', value: 'http://127.0.0.1:3000', mono: true },
      { k: 'tls', type: 'check', label: 'TLS with Let\'s Encrypt paths', value: true },
      { k: 'ws', type: 'check', label: 'WebSocket support', value: true },
      { k: 'b', type: 'text', label: 'Max upload size', value: '50m', mono: true },
    ],
    sample: {},
    run(v) {
      const w = v.ws ? '\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";' : '';
      const body = `    client_max_body_size ${v.b};\n\n    location / {\n        proxy_pass ${v.u};\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;${w}\n    }`;
      return { text: v.tls
        ? `server {\n    listen 80;\n    server_name ${v.h};\n    return 301 https://$host$request_uri;\n}\n\nserver {\n    listen 443 ssl;\n    http2 on;\n    server_name ${v.h};\n\n    ssl_certificate     /etc/letsencrypt/live/${v.h}/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/${v.h}/privkey.pem;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    add_header Strict-Transport-Security "max-age=31536000" always;\n\n${body}\n}`
        : `server {\n    listen 80;\n    server_name ${v.h};\n\n${body}\n}`, name: `${v.h}.conf` };
    },
  });
  T({
    id: 'ssh-tunnel', name: 'SSH Tunnel Builder', cat: 'linux',
    tags: 'port forward local remote dynamic socks bastion jump',
    fields: [
      { k: 'k', type: 'select', label: 'Type', options: [['L', 'Local: reach a remote service from here'], ['R', 'Remote: expose this machine through the server'], ['D', 'Dynamic: SOCKS proxy']], value: 'L' },
      { k: 'lp', type: 'num', label: 'Listen port', value: 8443, min: 1, max: 65535 },
      { k: 'th', type: 'text', label: 'Target host', value: '10.0.0.5', mono: true, show: (v) => v.k !== 'D' },
      { k: 'tp', type: 'num', label: 'Target port', value: 443, min: 1, max: 65535, show: (v) => v.k !== 'D' },
      { k: 'j', type: 'text', label: 'SSH server', value: 'admin@bastion.example.com', mono: true },
      { k: 'bg', type: 'check', label: 'Run in background (-fN)', value: true },
    ],
    sample: {},
    run(v) {
      const f = v.k === 'D' ? `-D ${v.lp}` : `-${v.k} ${v.lp}:${v.th}:${v.tp}`;
      return `ssh ${v.bg ? '-fN ' : ''}${f} ${v.j}`;
    },
  });
  T({
    id: 'openssl-builder', name: 'OpenSSL Command Builder', cat: 'linux', featured: true,
    tags: 'certificate csr pfx pem p12 key convert tls',
    fields: [
      { k: 't', type: 'select', label: 'Task', options: [['csr', 'New key and CSR with SANs'], ['self', 'Self-signed certificate'], ['pfx', 'PEM to PFX'], ['unpfx', 'PFX to PEM'], ['view', 'View a certificate'], ['match', 'Check that key and certificate match'], ['remote', 'Check a live server'], ['der', 'DER to PEM']], value: 'csr' },
      { k: 'h', type: 'text', label: 'Common name', value: 'app.example.com', mono: true },
      { k: 'san', type: 'text', label: 'Extra SANs', value: 'www.example.com', mono: true, show: (v) => v.t === 'csr' || v.t === 'self' },
    ],
    sample: {},
    run(v) {
      const h = v.h.trim(), f = h.replace(/[^\w.-]/g, '_');
      const san = ['DNS:' + h, ...u.tokens(v.san).map((s) => 'DNS:' + s)].join(',');
      return {
        csr: `openssl req -new -newkey rsa:2048 -nodes -keyout ${f}.key -out ${f}.csr \\\n  -subj "/CN=${h}" -addext "subjectAltName=${san}"`,
        self: `openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout ${f}.key -out ${f}.crt \\\n  -subj "/CN=${h}" -addext "subjectAltName=${san}"`,
        pfx: `openssl pkcs12 -export -out ${f}.pfx -inkey ${f}.key -in ${f}.crt -certfile chain.pem`,
        unpfx: `openssl pkcs12 -in ${f}.pfx -nokeys -out ${f}.crt\nopenssl pkcs12 -in ${f}.pfx -nocerts -nodes -out ${f}.key`,
        view: `openssl x509 -in ${f}.crt -noout -text`,
        match: `openssl x509 -in ${f}.crt -noout -pubkey | openssl sha256\nopenssl pkey -in ${f}.key -pubout | openssl sha256\n# the two hashes must be identical`,
        remote: `openssl s_client -connect ${h}:443 -servername ${h} </dev/null 2>/dev/null \\\n  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName`,
        der: `openssl x509 -inform der -in ${f}.cer -out ${f}.pem`,
      }[v.t];
    },
  });
  T({
    id: 'tar-builder', name: 'tar Command Builder', cat: 'linux',
    tags: 'archive compress extract gzip xz zstd',
    fields: [
      { k: 'a', type: 'seg', label: 'Action', options: ['Create', 'Extract', 'List'], value: 'Create' },
      { k: 'c', type: 'seg', label: 'Compression', options: [['z', 'gzip'], ['J', 'xz'], ['j', 'bzip2'], ['', 'None']], value: 'z' },
      { k: 'f', type: 'text', label: 'Archive', value: 'backup.tar.gz', mono: true },
      { k: 'p', type: 'text', label: 'Files, or target directory', value: '/var/www', mono: true },
      { k: 'v', type: 'check', label: 'Verbose' },
    ],
    sample: {},
    run(v) {
      const fl = { Create: 'c', Extract: 'x', List: 't' }[v.a] + v.c + (v.v ? 'v' : '') + 'f';
      return v.a === 'Create' ? `tar -${fl} ${v.f} ${v.p}` : v.a === 'Extract' ? `tar -${fl} ${v.f} -C ${v.p}` : `tar -${fl} ${v.f}`;
    },
  });
  T({
    id: 'rsync-builder', name: 'rsync Command Builder', cat: 'linux',
    tags: 'sync copy backup mirror ssh',
    fields: [
      { k: 's', type: 'text', label: 'Source', value: '/srv/data/', mono: true }, { k: 'd', type: 'text', label: 'Destination', value: 'backup@nas:/volume1/data/', mono: true },
      { k: 'del', type: 'check', label: 'Delete extras at destination' }, { k: 'z', type: 'check', label: 'Compress in transit', value: true }, { k: 'n', type: 'check', label: 'Dry run' }, { k: 'bw', type: 'num', label: 'Bandwidth limit KB/s (0 for none)', value: 0, min: 0 }, { k: 'ex', type: 'text', label: 'Excludes', value: '*.tmp .cache/', mono: true },
    ],
    sample: {},
    run(v) {
      const a = ['rsync -a' + (v.z ? 'z' : '') + 'hP'];
      if (v.del) a.push('--delete');
      if (v.n) a.push('--dry-run');
      if (+v.bw) a.push(`--bwlimit=${v.bw}`);
      u.tokens(v.ex).forEach((e) => a.push(`--exclude='${e}'`));
      a.push(v.s, v.d);
      return [v.del && !v.n ? { note: '--delete removes files at the destination. Try a dry run first.', tone: 'warn' } : null, { text: a.join(' ') }];
    },
  });
  T({
    id: 'find-builder', name: 'find Command Builder', cat: 'linux',
    tags: 'search cleanup files old large linux',
    fields: [
      { k: 'p', type: 'text', label: 'Path', value: '/var/log', mono: true }, { k: 'n', type: 'text', label: 'Name pattern', value: '*.log', mono: true }, { k: 'd', type: 'num', label: 'Older than (days, 0 for any)', value: 30, min: 0 }, { k: 's', type: 'text', label: 'Larger than', value: '100M', mono: true },
      { k: 'act', type: 'seg', label: 'Then', options: ['List', 'Details', 'Delete'], value: 'List' },
    ],
    sample: {},
    run(v) {
      const a = [`find ${v.p}`, '-type f'];
      if (v.n) a.push(`-name '${v.n}'`);
      if (+v.d) a.push(`-mtime +${v.d}`);
      if (v.s) a.push(`-size +${v.s}`);
      if (v.act === 'Details') a.push('-exec ls -lh {} +');
      if (v.act === 'Delete') a.push('-delete');
      return [v.act === 'Delete' ? { note: 'This deletes without asking. Run it once with List first.', tone: 'bad' } : null, { text: a.join(' ') }];
    },
  });
  T({
    id: 'linux-firewall', name: 'ufw / iptables Rule Builder', cat: 'linux',
    tags: 'allow deny port security linux nftables',
    fields: [
      { k: 'a', type: 'seg', label: 'Action', options: ['allow', 'deny'], value: 'allow' }, { k: 'pr', type: 'seg', label: 'Protocol', options: ['tcp', 'udp'], value: 'tcp' }, { k: 'p', type: 'num', label: 'Port', value: 22, min: 1, max: 65535 }, { k: 's', type: 'text', label: 'From (CIDR, blank for any)', value: '10.0.0.0/8', mono: true },
    ],
    sample: {},
    run(v) {
      const s = v.s.trim(), allow = v.a === 'allow';
      if (s) u.parseCIDR(s);
      return [
        { title: 'ufw', text: s ? `ufw ${v.a} from ${s} to any port ${v.p} proto ${v.pr}` : `ufw ${v.a} ${v.p}/${v.pr}` },
        { title: 'firewalld', text: s ? `firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="${s}" port port="${v.p}" protocol="${v.pr}" ${allow ? 'accept' : 'drop'}'` : allow ? `firewall-cmd --permanent --add-port=${v.p}/${v.pr}` : `firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="${v.p}" protocol="${v.pr}" drop'` },
        { title: 'iptables', text: `iptables -A INPUT -p ${v.pr}${s ? ` -s ${s}` : ''} --dport ${v.p} -j ${allow ? 'ACCEPT' : 'DROP'}` },
      ];
    },
  });
  ref({
    id: 'linux-cheatsheet', name: 'Linux Cheat Sheet', cat: 'linux',
    tags: 'bash commands troubleshooting shell terminal',
    head: ['Task', 'Command'],
    rows: table(`
Disk space|df -h
Biggest directories|du -xh --max-depth=1 / | sort -h | tail
Files deleted but still open|lsof +L1
Memory|free -h
Top CPU processes|ps aux --sort=-%cpu | head
Top memory processes|ps aux --sort=-%mem | head
Load and uptime|uptime
Listening ports|ss -tulpn
Who owns a port|ss -tulpn | grep :443
Routes|ip route
Addresses|ip -br a
Failed services|systemctl --failed
Service log|journalctl -u nginx -f
Errors since boot|journalctl -b -p err
Kernel messages|dmesg -T | tail -50
Out-of-memory kills|journalctl -k | grep -i oom
Last logins|last -a | head
Failed logins|lastb | head
Follow a log|tail -f /var/log/syslog
Replace text in a file|sed -i 's/old/new/g' file
Recursive search|grep -rn "text" /etc
Disk I/O|iostat -xz 2
Block devices|lsblk -f
Reload sudoers safely|visudo
OS version|cat /etc/os-release
Kernel version|uname -r
Open files limit|ulimit -n
Check a TLS expiry|openssl s_client -connect host:443 </dev/null | openssl x509 -noout -enddate
Capture traffic|tcpdump -ni eth0 port 53`),
  });
  ref({
    id: 'docker-k8s-cheatsheet', name: 'Docker & Kubernetes Cheat Sheet', cat: 'linux',
    tags: 'kubectl container pod logs compose',
    head: ['Task', 'Command'],
    rows: table(`
Running containers|docker ps
All containers|docker ps -a
Follow logs|docker logs -f name
Shell in a container|docker exec -it name sh
Resource use|docker stats
Disk use|docker system df
Clean unused data|docker system prune
Start a stack|docker compose up -d
Rebuild a stack|docker compose up -d --build
Stop a stack|docker compose down
Pods everywhere|kubectl get pods -A
Why a pod fails|kubectl describe pod name
Pod logs|kubectl logs -f name
Previous crash logs|kubectl logs name --previous
Shell in a pod|kubectl exec -it name -- sh
Recent events|kubectl get events --sort-by=.lastTimestamp
Rollout status|kubectl rollout status deploy/name
Restart a deployment|kubectl rollout restart deploy/name
Undo a rollout|kubectl rollout undo deploy/name
Port forward|kubectl port-forward svc/name 8080:80
Switch context|kubectl config use-context name
Node usage|kubectl top nodes`),
  });
  ref({
    id: 'git-cheatsheet', name: 'Git Cheat Sheet', cat: 'linux',
    tags: 'version control commit branch undo reset',
    head: ['Task', 'Command'],
    rows: table(`
Status|git status
Short history|git log --oneline --graph -20
New branch|git switch -c name
Change branch|git switch name
Stage all|git add -A
Commit|git commit -m "message"
Fix the last commit message|git commit --amend
Undo the last commit, keep the work|git reset --soft HEAD~1
Discard changes to a file|git restore file
Unstage a file|git restore --staged file
Stash work|git stash
Bring stash back|git stash pop
Update from remote|git pull --rebase
Push a new branch|git push -u origin name
Recover lost commits|git reflog
Who changed a line|git blame file
Delete a merged branch|git branch -d name
Tag a release|git tag -a v1.0 -m "v1.0"`),
  });
  ref({
    id: 'linux-signals', name: 'Signals & Exit Codes', cat: 'linux',
    tags: 'sigterm sigkill exit status 137 139 oom',
    head: ['Code', 'Name', 'Meaning'],
    rows: table(`
0|Success|Finished normally
1|General error|Catch-all failure
2|Misuse|Bad shell builtin usage
126|Cannot execute|Permission problem or not executable
127|Not found|Command not in PATH
128+n|Fatal signal|Killed by signal n
130|SIGINT|Ctrl+C
137|SIGKILL|Forced kill, often the OOM killer
139|SIGSEGV|Segmentation fault
143|SIGTERM|Polite termination, usually graceful stop
SIGHUP (1)|Hangup|Terminal closed, or reload config
SIGINT (2)|Interrupt|Ctrl+C
SIGQUIT (3)|Quit|Quit with core dump
SIGKILL (9)|Kill|Cannot be caught or ignored
SIGSEGV (11)|Segfault|Invalid memory access
SIGPIPE (13)|Broken pipe|Reader went away
SIGTERM (15)|Terminate|Default for kill
SIGSTOP (19)|Stop|Pause, cannot be caught
SIGCONT (18)|Continue|Resume a stopped process`),
  });

  // ---------- Capacity ----------
  const RAID = {
    '0': { min: 2, use: (n) => n, ft: () => 'None. One failure loses the array.' },
    '1': { min: 2, use: () => 1, ft: (n) => `${n - 1} disk(s)` },
    '5': { min: 3, use: (n) => n - 1, ft: () => '1 disk' },
    '6': { min: 4, use: (n) => n - 2, ft: () => '2 disks' },
    '10': { min: 4, even: 1, use: (n) => n / 2, ft: () => '1 per mirror pair' },
    '50': { min: 6, use: (n, g) => n - g, ft: () => '1 per RAID 5 group' },
    '60': { min: 8, use: (n, g) => n - 2 * g, ft: () => '2 per RAID 6 group' },
  };
  T({
    id: 'raid-calculator', name: 'RAID Calculator', cat: 'capacity', featured: true,
    tags: 'storage disk array nas san redundancy',
    fields: [
      { k: 'lvl', type: 'select', label: 'RAID level', options: Object.keys(RAID).map((k) => [k, 'RAID ' + k]), value: '6' },
      { k: 'n', type: 'num', label: 'Disks', value: 8, min: 2, max: 240 },
      { k: 's', type: 'num', label: 'Disk size (TB)', value: 8, min: 0, step: 'any' },
      { k: 'g', type: 'num', label: 'Groups', value: 2, min: 2, show: (v) => v.lvl === '50' || v.lvl === '60' },
    ],
    sample: { lvl: '6', n: 8, s: 8 },
    run(v) {
      const r = RAID[v.lvl], n = +v.n, g = +v.g;
      if (n < r.min) throw new Error(`RAID ${v.lvl} needs at least ${r.min} disks.`);
      if (r.even && n % 2) throw new Error('RAID 10 needs an even number of disks.');
      if ((v.lvl === '50' || v.lvl === '60') && (n % g || n / g < (v.lvl === '50' ? 3 : 4))) throw new Error(`The disks must divide evenly into groups of at least ${v.lvl === '50' ? 3 : 4}.`);
      const data = r.use(n, g), raw = n * v.s, use = data * v.s, tib = (use * 1e12) / 2 ** 40;
      return [{ meter: { label: 'Efficiency', value: use / raw || 0, text: `${u.nf((use / raw) * 100, 1)}%`, good: true } }, { kv: [['Raw capacity', `${u.nf(raw)} TB`], ['Usable capacity', `${u.nf(use)} TB`], ['As the OS reports it', `${u.nf(tib)} TiB`], ['Lost to redundancy', `${u.nf(raw - use)} TB`], ['Survives losing', r.ft(n)]] }];
    },
  });
  const SZ = [['B', 1], ['KB', 1e3], ['MB', 1e6], ['GB', 1e9], ['TB', 1e12], ['PB', 1e15], ['KiB', 2 ** 10], ['MiB', 2 ** 20], ['GiB', 2 ** 30], ['TiB', 2 ** 40], ['PiB', 2 ** 50]];
  T({
    id: 'data-size-converter', name: 'Data Size Converter', cat: 'capacity',
    tags: 'kb mb gb tb kib mib gib tib disk binary decimal unit',
    fields: [{ k: 'x', type: 'num', label: 'Value', value: 1, min: 0, step: 'any' }, { k: 'unit', type: 'select', label: 'Unit', options: SZ.map((s) => s[0]), value: 'TB' }],
    sample: { x: 1, unit: 'TB' },
    run(v) {
      const b = v.x * SZ.find((s) => s[0] === v.unit)[1];
      return { kv: SZ.map(([n, f]) => [n, u.nf(b / f, 6)]) };
    },
  });
  T({
    id: 'backup-calculator', name: 'Backup Storage Estimator', cat: 'capacity',
    tags: 'veeam retention incremental dedupe capacity plan',
    fields: [
      { k: 's', type: 'num', label: 'Source data (TB)', value: 10, min: 0, step: 'any' }, { k: 'c', type: 'num', label: 'Daily change %', value: 3, min: 0, max: 100, step: 'any' }, { k: 'd', type: 'num', label: 'Daily backups kept', value: 14, min: 0 }, { k: 'w', type: 'num', label: 'Full backups kept', value: 4, min: 1 }, { k: 'r', type: 'num', label: 'Data reduction ratio (x:1)', value: 2, min: 1, step: 'any' }, { k: 'g', type: 'num', label: 'Yearly growth %', value: 20, min: 0, step: 'any' },
    ],
    sample: {},
    run(v) {
      const full = v.w * v.s, inc = v.d * v.s * (v.c / 100), raw = full + inc, net = raw / v.r, y = net * (1 + v.g / 100);
      return { kv: [['Before reduction', `${u.nf(raw)} TB`], ['Repository needed now', `${u.nf(net)} TB`], ['Needed in one year', `${u.nf(y)} TB`], ['Needed in three years', `${u.nf(net * (1 + v.g / 100) ** 3)} TB`], ['Each incremental', `${u.nf((v.s * (v.c / 100)) / v.r * 1000, 0)} GB`]] };
    },
  });
  T({
    id: 'log-storage', name: 'Log Storage Estimator', cat: 'capacity',
    tags: 'siem eps splunk elastic ingest gb per day',
    fields: [{ k: 'e', type: 'num', label: 'Events per second', value: 2500, min: 0 }, { k: 'b', type: 'num', label: 'Average event size (bytes)', value: 600, min: 1 }, { k: 'd', type: 'num', label: 'Retention (days)', value: 90, min: 1 }, { k: 'c', type: 'num', label: 'Compression ratio (x:1)', value: 3, min: 1, step: 'any' }, { k: 'rep', type: 'num', label: 'Copies', value: 1, min: 1 }],
    sample: {},
    run(v) {
      const day = v.e * v.b * 86400;
      return { kv: [['Ingest per day', u.fmtBytes(day, 1000)], ['Ingest per month', u.fmtBytes(day * 30, 1000)], ['Stored for retention', u.fmtBytes((day * v.d * v.rep) / v.c, 1000)], ['Sustained bandwidth', `${u.nf((v.e * v.b * 8) / 1e6)} Mbps`]] };
    },
  });
  T({
    id: 'capacity-forecast', name: 'Capacity Forecast', cat: 'capacity',
    tags: 'disk full growth trend plan runway',
    fields: [{ k: 't', type: 'num', label: 'Total capacity', value: 100, min: 0, step: 'any' }, { k: 'u', type: 'num', label: 'Used today', value: 72, min: 0, step: 'any' }, { k: 'g', type: 'num', label: 'Growth per month', value: 2.5, min: 0, step: 'any' }, { k: 'w', type: 'num', label: 'Alert threshold %', value: 85, min: 1, max: 100 }],
    sample: {},
    run(v) {
      if (!(v.t > 0)) return null;
      const when = (lim) => { const m = (lim - v.u) / v.g; return !isFinite(m) ? 'Never at this rate' : m <= 0 ? 'Already reached' : new Date(Date.now() + m * 30.44 * 864e5).toDateString() + ` (${u.nf(m, 1)} months)`; };
      return [{ meter: { label: 'Used', value: v.u / v.t, text: `${u.nf((v.u / v.t) * 100, 1)}%` } }, { kv: [[`Hits ${v.w}% on`, when((v.t * v.w) / 100)], ['Full on', when(v.t)]] }];
    },
  });
  T({
    id: 'ups-runtime', name: 'UPS Runtime Estimator', cat: 'capacity',
    tags: 'battery power outage watts wh va',
    fields: [{ k: 'wh', type: 'num', label: 'Battery energy (Wh)', value: 864, min: 0 }, { k: 'w', type: 'num', label: 'Load (W)', value: 450, min: 0 }, { k: 'e', type: 'num', label: 'Inverter efficiency %', value: 90, min: 1, max: 100 }, { k: 'a', type: 'num', label: 'Battery health %', value: 80, min: 1, max: 100 }],
    sample: {},
    run(v) {
      if (!(v.w > 0)) return null;
      const h = (v.wh * (v.e / 100) * (v.a / 100)) / v.w;
      return { big: u.fmtDur(h * 3600), small: true };
    },
  });
  T({
    id: 'power-heat', name: 'Power & Heat Calculator', cat: 'capacity',
    tags: 'btu cooling rack electricity kwh cost amps',
    fields: [{ k: 'w', type: 'num', label: 'Load (W)', value: 3000, min: 0 }, { k: 'v', type: 'num', label: 'Supply voltage', value: 230, min: 1 }, { k: 'pf', type: 'num', label: 'Power factor', value: 0.95, min: 0.1, max: 1, step: 'any' }, { k: 'c', type: 'num', label: 'Price per kWh', value: 0.25, min: 0, step: 'any' }],
    sample: {},
    run(v) {
      const kwh = (v.w / 1000) * 8760;
      return { kv: [['Current', `${u.nf(v.w / (v.v * v.pf))} A`], ['Apparent power', `${u.nf(v.w / v.pf, 0)} VA`], ['Heat output', `${u.nf(v.w * 3.412, 0)} BTU/hr`], ['Cooling', `${u.nf((v.w * 3.412) / 12000)} tons`], ['Energy per year', `${u.nf(kwh, 0)} kWh`], ['Cost per year', u.nf(kwh * v.c)]] };
    },
  });

  // ---------- Helpdesk ----------
  T({ id: 'system-info', name: 'System Info Snapshot', cat: 'helpdesk', featured: true, tags: 'browser screen resolution user agent device diagnostics', custom: 'systemInfo', fields: [] });
  T({ id: 'keyboard-tester', name: 'Keyboard Tester', cat: 'helpdesk', featured: true, tags: 'keys stuck hardware test', custom: 'keyboard', fields: [] });
  T({ id: 'mouse-tester', name: 'Mouse & Click Tester', cat: 'helpdesk', tags: 'double click button scroll hardware', custom: 'mouse', fields: [] });
  T({ id: 'camera-test', name: 'Webcam Test', cat: 'helpdesk', featured: true, tags: 'video meeting teams zoom hardware', custom: 'camera', fields: [] });
  T({ id: 'microphone-test', name: 'Microphone Test', cat: 'helpdesk', tags: 'audio mic input meeting hardware', custom: 'mic', fields: [] });
  T({ id: 'speaker-test', name: 'Speaker Test', cat: 'helpdesk', tags: 'audio sound stereo left right hardware', custom: 'speaker', fields: [] });
  T({ id: 'screen-test', name: 'Display Test', cat: 'helpdesk', tags: 'dead pixel monitor screen hardware fullscreen', custom: 'screen', fields: [] });
  T({
    id: 'ticket-notes', name: 'Ticket Note Template', cat: 'helpdesk',
    tags: 'incident itsm servicenow write up resolution',
    fields: [
      { k: 'who', type: 'text', label: 'Affected user or system' }, { k: 'sym', type: 'area', label: 'Symptoms', rows: 2 }, { k: 'imp', type: 'select', label: 'Impact', options: ['One user', 'A team', 'A site', 'Everyone'], value: 'One user' },
      { k: 'tried', type: 'area', label: 'What was tried, one per line', rows: 3 }, { k: 'cause', type: 'text', label: 'Root cause' }, { k: 'fix', type: 'area', label: 'Resolution', rows: 2 }, { k: 'next', type: 'text', label: 'Follow-up' },
    ],
    sample: { who: 'Finance shared drive', sym: 'Users cannot map S: since 09:00', tried: 'Checked DNS\nRestarted Server service on fs02', cause: 'Expired service account password', fix: 'Reset the password and restarted the service', next: 'Move to a gMSA' },
    run(v) {
      if (!v.who && !v.sym) return null;
      const s = (t, b) => (b ? `${t}:\n${b}\n\n` : '');
      return (s('Affected', v.who) + s('Impact', v.imp) + s('Symptoms', v.sym) + s('Steps taken', u.lines(v.tried).filter((x) => x.trim()).map((x) => '- ' + x.trim()).join('\n')) + s('Root cause', v.cause) + s('Resolution', v.fix) + s('Follow-up', v.next)).trim();
    },
  });
  T({
    id: 'onboarding-checklist', name: 'Joiner / Leaver Checklist', cat: 'helpdesk',
    tags: 'onboarding offboarding new starter hr access',
    fields: [{ k: 'k', type: 'seg', label: 'Type', options: ['Joiner', 'Leaver'], value: 'Joiner' }, { k: 'n', type: 'text', label: 'Name', value: 'Sam Example' }, { k: 'd', type: 'date', label: 'Date', value: () => new Date().toISOString().slice(0, 10) }, { k: 'lap', type: 'check', label: 'Has a laptop', value: true }, { k: 'priv', type: 'check', label: 'Has admin access' }],
    sample: {},
    run(v) {
      const J = ['Create the account and set a temporary password', 'Add to department groups and distribution lists', 'Assign licences', 'Enrol in MFA', v.lap && 'Build, encrypt and asset-tag the laptop', 'Set up the phone and voicemail', 'Share the security and acceptable-use policies', 'Book a first-day IT session'];
      const L = ['Disable the account at the agreed time', 'Revoke active sessions and MFA methods', 'Remove licences and group memberships', 'Set the mail forward or out-of-office, and share the mailbox with the manager', 'Transfer OneDrive and file ownership', v.lap && 'Recover, wipe and re-tag the laptop', 'Collect badge, keys and tokens', v.priv && 'Rotate any shared admin credentials they knew', 'Remove from third-party SaaS'];
      return { text: `${v.k} checklist: ${v.n} (${v.d})\n\n` + (v.k === 'Joiner' ? J : L).filter(Boolean).map((x) => `[ ] ${x}`).join('\n'), name: 'checklist.txt' };
    },
  });
})();
