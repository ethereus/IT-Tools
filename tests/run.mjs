// node tests/run.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { X509Certificate, createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ TextEncoder, TextDecoder, crypto, btoa, atob, URL, Blob, Response, CompressionStream, DecompressionStream, Intl, console, setTimeout, setImmediate, performance });
vm.runInContext('globalThis.self = globalThis', ctx);
for (const m of readFileSync(join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)) {
  if (/app\.js|custom\.js/.test(m[1])) continue;
  vm.runInContext(readFileSync(join(root, m[1]), 'utf8'), ctx, { filename: m[1] });
}
const IT = ctx.IT;
const { u } = IT;

let pass = 0;
const fails = [];
const eq = (name, got, want) => {
  const a = typeof got === 'string' ? got : JSON.stringify(got);
  const b = typeof want === 'string' ? want : JSON.stringify(want);
  if (a === b) pass++;
  else fails.push(`${name}\n    got  ${a}\n    want ${b}`);
};
const run = async (id, v) => {
  const t = IT.byId[id];
  return t.run({ ...IT.defaults(t), ...v });
};
const kv = async (id, v) => {
  const r = await run(id, v);
  const b = (Array.isArray(r) ? r : [r]).find((x) => x && x.kv);
  return Object.fromEntries(b.kv);
};
const txt = (s) => new TextEncoder().encode(s);

// ---- the original converter must behave exactly as it did ----
function original(input) {
  let result;
  if (isNaN(input)) result = 'x';
  else if (input < 10) result = input + 50;
  else if (input > 10 && input < 100) result = input;
  else if (input > 300 && input < 500) result = input - 200;
  else if (input > 500) { const t = input - 300; result = t > 255 ? t - 100 : t; }
  else if (input >= 100 && input < 200) result = input - 100;
  else result = null;
  return result;
}
for (let i = -20; i <= 1200; i += 0.5) eq(`router ${i}`, IT.routerConvert(i).out, original(i));

// ---- hashes ----
eq('md5 empty', u.hex(u.md5(new Uint8Array())), 'd41d8cd98f00b204e9800998ecf8427e');
eq('md5 fox', u.hex(u.md5(txt('The quick brown fox jumps over the lazy dog'))), '9e107d9d372bb6826bd81d3542a419d6');
eq('md5 vs node, 1000 bytes', u.hex(u.md5(new Uint8Array(1000).fill(97))), createHash('md5').update(Buffer.alloc(1000, 97)).digest('hex'));
for (let n = 50; n < 70; n++) eq(`md5 pad ${n}`, u.hex(u.md5(new Uint8Array(n).fill(7))), createHash('md5').update(Buffer.alloc(n, 7)).digest('hex'));
eq('md4 abc', u.hex(u.md4(txt('abc'))), 'a448017aaf21d8525fc10ae87aa6729d');
eq('crc32', u.crc32(txt('123456789')).toString(16), 'cbf43926');
eq('adler32', u.adler32(txt('Wikipedia')).toString(16), '11e60398');
eq('ntlm', (await kv('hash-generator', { x: 'password' })).NTLM, '8846f7eaee8fb117ad06bdd830b7586c');
eq('sha256', (await kv('hash-generator', { x: 'abc' }))['SHA-256'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
eq('hmac rfc4231', (await kv('hmac-generator', { x: 'what do ya want for nothing?', key: 'Jefe' })).Hex, '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
eq('pbkdf2 sha256', (await kv('pbkdf2', { p: 'password', salt: 'salt', it: 1, len: 32 })).Hex, '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'.slice(0, 64));
eq('apr1', IT.apr1('myPassword', 'r31.....'), '$apr1$r31.....$HqJZimcKQFAMYayBlzkrA/');

// ---- OTP and codes ----
eq('totp rfc6238 t=59', await IT.totp(txt('12345678901234567890'), 59, 8, 30), '94287082');
eq('totp rfc6238 t=1111111109', await IT.totp(txt('12345678901234567890'), 1111111109, 8, 30), '07081804');
eq('base32', u.b32enc(txt('foobar')), 'MZXW6YTBOI======');
eq('base32 back', u.fromUtf8(u.b32dec('MZXW6YTBOI======')), 'foobar');
eq('type7 decode', IT.type7.decode('0822455D0A16'), 'cisco');
eq('type7 round', IT.type7.decode(IT.type7.encode('S3cret!', 9)), 'S3cret!');
eq('cvss critical', IT.cvss({ AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' }), 9.8);
eq('cvss changed', IT.cvss({ AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'C', C: 'H', I: 'H', A: 'H' }), 10);
eq('cvss medium', IT.cvss({ AV: 'L', AC: 'L', PR: 'L', UI: 'N', S: 'U', C: 'L', I: 'N', A: 'N' }), 3.3);
eq('punycode enc', IT.punyEncode('bücher'), 'bcher-kva');
eq('punycode dec', IT.punyDecode('bcher-kva'), 'bücher');
eq('punycode no ascii', IT.punyDecode(IT.punyEncode('日本語')), '日本語');
eq('code128 check digit', IT.code128('PJJ123C'), [104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);

// ---- subnets ----
const s = await kv('subnet-calculator', { cidr: '192.168.10.34/26' });
eq('subnet net', s.Network, '192.168.10.0/26');
eq('subnet bcast', s.Broadcast, '192.168.10.63');
eq('subnet hosts', s['Usable hosts'], '62');
eq('/31', (await kv('subnet-calculator', { cidr: '10.0.0.0/31' }))['Usable hosts'], '2');
eq('/0', (await kv('subnet-calculator', { cidr: '1.2.3.4/0' }))['Total addresses'], '4,294,967,296');
eq('mask form', (await kv('subnet-calculator', { cidr: '10.1.1.1 255.255.255.0' })).Network, '10.1.1.0/24');
eq('range', u.rangeToCidrs(u.parseIPv4('10.0.0.5'), u.parseIPv4('10.0.0.8')), ['10.0.0.5/32', '10.0.0.6/31', '10.0.0.8/32']);
eq('range full', u.rangeToCidrs(0, 4294967295), ['0.0.0.0/0']);
eq('aggregate', (await run('cidr-aggregator', { list: '192.168.0.0/24 192.168.1.0/24 192.168.2.0/23' })).text, '192.168.0.0/22');
eq('v6 short', u.ipv6Short(u.parseIPv6('2001:0db8:0000:0000:0001:0000:0000:0001')), '2001:db8::1:0:0:1');
eq('v6 rfc5952 single zero', u.ipv6Short(u.parseIPv6('2001:db8:0:1:1:1:1:1')), '2001:db8:0:1:1:1:1:1');
eq('v6 embedded v4', u.ipv6Short(u.parseIPv6('::ffff:192.0.2.1')), '::ffff:c000:201');
eq('v6 all zero', u.ipv6Short(0n), '::');
eq('v6 ptr', u.ip6Arpa(u.parseIPv6('2001:db8::1')).slice(0, 12), '1.0.0.0.0.0.');
eq('eui64', (await kv('mac-to-eui64', { x: '00:1a:2b:3c:4d:5e' }))['Link-local'], 'fe80::21a:2bff:fe3c:4d5e');
eq('mtu', (await kv('mtu-calculator', { mtu: 1500, enc: 'none', ip: '4' }))['TCP MSS clamp'], '1460 bytes');
const vl = await run('vlsm-planner', { net: '10.0.0.0/24', req: 'a 100\nb 50\nc 2' });
eq('vlsm', vl[0].table.rows.map((r) => r[2]), ['10.0.0.0/25', '10.0.0.128/26', '10.0.0.192/30']);

// ---- time ----
eq('filetime', IT.filetime(116444736000000000n).toISOString(), '1970-01-01T00:00:00.000Z');
eq('wall to utc, BST', IT.wallToUtc('2026-07-01T09:00', 'Europe/London').toISOString(), '2026-07-01T08:00:00.000Z');
eq('wall to utc, NY winter', IT.wallToUtc('2026-01-15T09:00', 'America/New_York').toISOString(), '2026-01-15T14:00:00.000Z');
eq('cron 5 fields', IT.cronExplain(IT.parseCron('30 2 * * 1-5')), 'At 02:30 on Monday, Tuesday, Wednesday, Thursday, Friday');
{
  const c = IT.parseCron('0 12 13 * 5'); // dom OR dow
  const n = IT.cronNext(c, new Date(2026, 0, 1, 0, 0), 2).map((d) => [d.getMonth() + 1, d.getDate()]);
  eq('cron dom or dow', n, [[1, 2], [1, 9]]);
  const m = IT.cronNext(IT.parseCron('*/15 * * * *'), new Date(2026, 0, 1, 0, 7), 2).map((d) => d.getMinutes());
  eq('cron step', m, [15, 30]);
  eq('cron sunday 7', [...IT.parseCron('0 0 * * 7').dow.set], [0]);
}
eq('sla', (await run('sla-calculator', { p: 99.9, out: 0 }))[0].table.rows[4][1], '8 hours 45 minutes 36 seconds');
eq('excel', (await kv('excel-date', { x: '46023' }))['Date (UTC)'].slice(0, 10), '2026-01-01');

// ---- Windows ----
const sid = 'S-1-5-21-3623811015-3361044348-30300820-512';
eq('sid round', IT.binToSid(IT.sidToBin(sid)), sid);
eq('sid name', (await kv('sid-decoder', { x: sid })).Account, 'Domain Admins');
eq('sid wellknown', (await kv('sid-decoder', { x: 'S-1-5-18' })).Account, 'SYSTEM');
eq('guid round', (await kv('guid-converter', { x: (await kv('guid-converter', { x: '2c8a3f4e-1b7d-4a19-9c55-0f6e2d3a1b7c' }))['Base64 (ImmutableId)'] })).GUID, '2c8a3f4e-1b7d-4a19-9c55-0f6e2d3a1b7c');
eq('guid bytes', (await kv('guid-converter', { x: '00112233-4455-6677-8899-aabbccddeeff' }))['Octet string'], '33221100554477668899AABBCCDDEEFF');
eq('uac', (await run('uac-decoder', { x: '66050' }))[1].table.rows.map((r) => r[1]), ['ACCOUNTDISABLE', 'NORMAL_ACCOUNT', 'DONT_EXPIRE_PASSWORD']);
eq('group', (await kv('ad-group-type', { x: '-2147483646' })).Scope, 'Global');
eq('hresult', (await run('windows-error-lookup', { x: '0x80070005' }))[0].big, 'Access is denied');
eq('hresult neg', (await run('windows-error-lookup', { x: '-2147024891' }))[0].big, 'Access is denied');
eq('win32 dec', (await run('windows-error-lookup', { x: '1326' }))[0].big, 'Unknown user name or bad password');
eq('ntstatus', (await run('windows-error-lookup', { x: 'C000006A' }))[0].big, 'The user exists but the password is wrong');
eq('dn', (await kv('dn-parser', { x: 'CN=Jo Bloggs,OU=Staff,DC=corp,DC=example,DC=com' }))['Canonical name'], 'corp.example.com/Staff/Jo Bloggs');
eq('dn back', (await kv('dn-parser', { x: 'corp.example.com/Staff/Jo Bloggs' }))['Distinguished name'], 'CN=Jo Bloggs,OU=Staff,DC=corp,DC=example,DC=com');
eq('dn escaped comma', (await kv('dn-parser', { x: 'CN=Bloggs\\, Jo,DC=x' })).Object, 'Bloggs, Jo');
eq('usernames', (await run('username-generator', { x: 'John Smith\nJohn Smith', pat: 'flast', dom: 'x.io', max: 20 })).table.rows.map((r) => r[1]), ['jsmith', 'jsmith2']);

// ---- Linux ----
eq('chmod', (await kv('chmod-calculator', { x: '2775' })).Symbolic, 'rwxrwsr-x');
eq('chmod sym', (await kv('chmod-calculator', { x: 'rwxr-xr-x' })).Octal, '755');
eq('umask', (await kv('umask-calculator', { x: '027' }))['New files'], '640  rw-r-----');
const comp = IT.dockerRunToCompose('docker run -d --name web -p 80:80 -e "A=b c" --restart=always nginx:1 nginx -g x');
eq('compose', JSON.parse(JSON.stringify(comp)), { services: { web: { image: 'nginx:1', ports: ['80:80'], environment: ['A=b c'], restart: 'always', command: ['nginx', '-g', 'x'] } } });
eq('raid6', (await kv('raid-calculator', { lvl: '6', n: 8, s: 8 }))['Usable capacity'], '48 TB');

// ---- data ----
eq('csv quotes', u.parseCSV('a,b\n"x, y","q""r"\n'), [['a', 'b'], ['x, y', 'q"r']]);
eq('yaml', JSON.parse(await run('json-yaml', { x: 'a:\n  - 1\n  - two', mode: 'YAML to JSON' })), { a: [1, 'two'] });
eq('diff', IT.diffLines(['a', 'b', 'c'], ['a', 'x', 'c']).map((d) => d.join('')).join('|'), ' a|-b|+x| c');
eq('sql keeps strings', (await run('sql-formatter', { x: "select 'from x' from t" })).includes("'from x'"), true);
eq('ps encode round', (await run('powershell-encoded', { x: (await run('powershell-encoded', { x: 'Get-Date', mode: 'Encode' })), mode: 'Decode' }))[1].text, 'Get-Date');
eq('hex decode', await run('hex-text', { x: '49 54', mode: 'Decode' }), 'IT');
eq('base64 utf8', await run('base64', { x: 'Y2Fmw6k=', mode: 'Decode' }), 'café');
eq('qp', await run('quoted-printable', { x: 'Caf=C3=A9', mode: 'Decode' }), 'Café');
eq('number', (await kv('number-base', { x: 'ff', b: '16' })).Decimal, '255');
eq('bignum', (await kv('number-base', { x: '123456789012345678901234567890', b: '10' })).Hex, '18EE90FF6C373E0EE4E3F0AD2');
eq('contrast', Math.round(IT.contrast([0, 0, 0], [255, 255, 255])), 21);

// ---- certificates, checked against Node's own X.509 parser ----
const sampleCert = IT.byId['certificate-decoder'].sample.x;
const nodeCert = new X509Certificate(sampleCert);
const der = u.unb64(sampleCert.replace(/-----[^-]+-----/g, ''));
const mine = IT.parseCert(der);
eq('cert subject', mine.subject.split(', ').sort().join('\n'), nodeCert.subject.split('\n').sort().join('\n').replace(/^CN=.*$/m, (x) => x));
eq('cert to', mine.notAfter.getTime(), new Date(nodeCert.validTo).getTime());
eq('cert from', mine.notBefore.getTime(), new Date(nodeCert.validFrom).getTime());
eq('cert sans', mine.sans, ['DNS:tools.example.com', 'DNS:www.example.com', 'IP:192.0.2.10']);
eq('cert serial', mine.serial.replace(/^0+/, '').toUpperCase(), nodeCert.serialNumber.replace(/^0+/, ''));
eq('cert fp', (await run('certificate-decoder', { x: sampleCert }))[1].kv.find((r) => r[0].startsWith('SHA-256'))[1], nodeCert.fingerprint256);
eq('cert key', mine.key, 'RSA 2048 bit');
const csr = IT.parseCSR(u.unb64(IT.byId['csr-decoder'].sample.x.replace(/-----[^-]+-----/g, '')));
eq('csr sans', csr.sans, ['DNS:tools.example.com', 'DNS:www.example.com', 'IP:192.0.2.10']);

// ---- generators ----
const pw = (await run('password-generator', { len: 24, n: 50 }))[0].text.split('\n');
eq('password count', pw.length, 50);
eq('password classes', pw.every((p) => p.length === 24 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^a-zA-Z0-9]/.test(p)), true);
eq('uuid v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(await run('uuid-generator', { n: 1 })), true);
eq('uuid v7', /^[0-9a-f]{8}-[0-9a-f]{4}-7/.test(await run('uuid-generator', { n: 1, ver: 'v7' })), true);
const mac = await run('mac-generator', { n: 20 });
eq('mac local unicast', mac.split('\n').every((m) => (parseInt(m.slice(0, 2), 16) & 3) === 2), true);
const enc = await run('aes-encrypt', { x: 'secret', p: 'pw', mode: 'Encrypt' });
eq('aes round', await run('aes-encrypt', { x: enc, p: 'pw', mode: 'Decrypt' }), 'secret');
const jw = await run('jwt-generator', { key: 'k', ttl: 0 });
eq('jwt sign+verify', (await run('jwt-decoder', { x: jw, key: 'k' })).some((b) => /verified/.test(b.note || '')), true);
eq('bcrypt', ctx.dcodeIO.bcrypt.compareSync('example', await run('bcrypt-tool', { p: 'example', cost: 4 })), true);
eq('gzip round', await run('gzip-tool', { x: (await run('gzip-tool', { x: 'hello', mode: 'Compress' })).text, mode: 'Decompress' }), 'hello');
eq('barcode', typeof (await run('barcode-generator', { x: 'IT-1' })).svg, 'string');

// ---- every tool: its example runs and produces something ----
const skipped = [];
for (const t of IT.tools) {
  if (t.custom || t.net) { skipped.push(t.id); continue; }
  const v = IT.defaults(t, true);
  for (const f of t.fields) if (f.type === 'file') v[f.k] = { name: 'a.bin', type: '', bytes: new TextEncoder().encode('MZ test file') };
  try {
    const r = await t.run(v);
    const empty = r === null || r === undefined || (Array.isArray(r) && !r.some(Boolean));
    if (empty) fails.push(`${t.id}: example produced no output`); else pass++;
  } catch (e) { fails.push(`${t.id}: ${e.message}`); }
}

console.log(`${IT.tools.length} tools registered, ${skipped.length} need a browser or network: ${skipped.join(', ')}`);
console.log(`${pass} checks passed, ${fails.length} failed`);
for (const f of fails) console.log(' FAIL ' + f);
process.exit(fails.length ? 1 : 0);
