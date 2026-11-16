(function () {
  'use strict';
  const { tool: T, u } = IT;
  const hx = u.hex;

  // ---------- Generators ----------
  const SETS = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?/' };
  const AMBIG = /[Il1O0oS5Z2]/g;
  T({
    id: 'password-generator', name: 'Password Generator', cat: 'security', featured: true, regen: true,
    tags: 'random secure credential',
    fields: [
      { k: 'len', type: 'range', label: 'Length', value: 20, min: 8, max: 128 },
      { k: 'n', type: 'num', label: 'How many', value: 5, min: 1, max: 100 },
      { k: 'upper', type: 'check', label: 'Uppercase', value: true },
      { k: 'lower', type: 'check', label: 'Lowercase', value: true },
      { k: 'digits', type: 'check', label: 'Digits', value: true },
      { k: 'symbols', type: 'check', label: 'Symbols', value: true },
      { k: 'noamb', type: 'check', label: 'Avoid look-alikes (I, l, 1, O, 0)' },
    ],
    sample: {},
    run(v) {
      const on = Object.keys(SETS).filter((k) => v[k]);
      if (!on.length) throw new Error('Choose at least one character type.');
      const sets = on.map((k) => (v.noamb ? SETS[k].replace(AMBIG, '') : SETS[k]));
      const all = sets.join('');
      const len = Math.max(+v.len, sets.length);
      const out = [];
      for (let i = 0; i < Math.min(+v.n || 1, 100); i++) {
        // one from each chosen set, then fill and shuffle
        const c = sets.map((s) => s[u.randInt(s.length)]);
        while (c.length < len) c.push(all[u.randInt(all.length)]);
        out.push(u.shuffle(c).join(''));
      }
      return [{ text: out.join('\n') }, { kv: [['Alphabet', `${all.length} characters`], ['Entropy', `about ${Math.floor(len * Math.log2(all.length))} bits each`]] }];
    },
  });

  const WORDS = [...new Set('able acid acorn actor adapt admit adult agent agree ahead aisle alarm album alert algae alley allow alloy alpha amber amend ample angle ankle apple apply april apron arena argue armor aroma arrow asset atlas attic audio audit autumn avoid award awake bacon badge bagel baker balmy bamboo banjo barge basil basin batch beach beacon beard beaver begin bench berry bison blade blank blaze bleak blend bliss block bloom blue board boast bonus boost booth bound brain brake brass brave bread brick bride brief bring brisk broad brook broom brush bucket buddy buggy build bulb bunch burst butter cabin cable cactus cadet camel camera candle candy canoe canvas canyon carbon cargo carpet carrot carve castle catch cedar chalk charm chart chase cheer chess chest chief chill chimney chord chunk cider cinema circle civic claim clamp class clean clerk click cliff climb clock cloud clover coach coast cobalt cocoa comet comic coral corner cotton couch count cover craft crane crate cream creek crest crisp crowd crown crumb crust cubic curve cycle daily dairy daisy dance dawn debug decal decoy delta denim depot depth derby desert desk dial diary diesel dimple diner disco ditch dizzy dock dodge dolphin domain donut dozen draft dragon drain drama dream dress drift drill drive drone drum dusk dwarf eager eagle early earth easel ebony echo eight elbow elder elect elegant elite elm ember emerald empty enjoy enter envoy equal equip erase error essay ethic even event exact exile exist extra fable fabric faint fairy falcon fancy farm feast fence ferry fetch fever fiber field fifth final finch first fiscal fixer flame flash flask fleet flint float flock floor flora flour fluid flute focus foggy forest forge forum fossil found fox frame fresh frost fruit fudge galaxy gamma garden garlic gauge gecko gentle giant ginger glade glass globe glory glove gnome goose gorge grain grand grape graph grass gravel great green greet grid grill groove group grove guard guest guide guitar habit hammer hamster harbor harp harvest hatch haven hazel heart heavy hedge helix helmet herb heron hiker hinge hippo hobby honey hood horizon horse hotel hound house human humor hurry husky ice icon ideal igloo image index indigo inlet inner input ivory jacket jade jazz jelly jewel jigsaw joint jolly judge juice jumbo jungle juniper kayak kettle kiosk kite kitten kiwi knack knee knight koala label ladder lagoon lake lamp lantern laser latch lava lawn layer leaf lemon lens level lever light lilac lily limit linen lion liquid llama lobby lobster local lodge logic lotus lucky lumber lunar lunch lyric macro magic magnet maize major mango manor maple marble march marine market marsh mason matrix meadow medal melon mentor mercy merit metal meteor metro midnight mimic mineral minor mint mirror mixer model modem molar monitor month moose morning mosaic moss motor mountain mouse muffin mural museum music mustard mystic napkin narrow navy nebula nectar needle nest neutron nickel night nimble noble noodle north notch novel nugget nutmeg oasis oat ocean octave olive omega onion opal opera orange orbit orchid organ otter outer owl oxide oyster paddle pagoda paint palace palm panda panel panther paper parade parcel park parrot pasta patch path patio pause peach peak peanut pearl pebble pedal pelican penguin pepper perch piano pickle pigeon pilot pine pink pioneer pipe pivot pixel pizza planet plank plant plate plaza plum plush poem poet polar pond pony poppy portal potato pouch power prairie prism proof proton proud pulse pumpkin punch puppy purple puzzle pyramid quail quartz queen quest quick quiet quill quilt quiz quota rabbit radar radio radish rain ramp ranch range rapid raven razor reach ready realm rebel recipe reef relay relic remote rhino rhyme ribbon ridge rifle ring ripple river road robin robot rocket rodeo roof room root rose rotor round route rowan royal rubber ruby rugby ruler rumble rustic saddle saffron sage sail salad salmon salsa salt sample sand satin sauce sauna scale scarf scene scout screen script scroll seal season second seed sensor sequel shade shadow shark shell shelf shield shift shine shirt shore shrub sierra signal silk silver siren sketch skiff skill slate sleek slice slope smart smile smith smoke snack snail snow socket sofa solar solid sonar sound spark spice spider spike spinach spiral spoon sport spray spruce squid stable stack stage stair stamp star steam steel stem stone storm story stove straw stream street stride studio sugar summit sunny surf swan sweet swift syrup table tablet tackle tango tank tape target teapot teal temple tennis tent thorn thread thumb thunder tidal tiger timber tiny toast token tomato tonic topaz torch totem tower trail train travel treble tree trend trial tribe trout truck tulip tuna tunnel turbo turtle tweed twig twin ultra umbrella uncle union unit unity upper urban usage valley valve vanilla vapor vault vector velvet vendor verse vessel violet violin viper virtual vision vista vital vivid vocal voice volt voyage waffle wagon walnut walrus water wave wax weasel weaver wedge whale wheat wheel whisper willow window winter wizard wolf wombat wonder wood world woven yacht yarn yellow yodel yogurt zebra zenith zephyr zigzag zinc zipper zone zoom'.split(' '))];
  IT.WORDS = WORDS;
  T({
    id: 'passphrase-generator', name: 'Passphrase Generator', cat: 'security', regen: true,
    tags: 'diceware words memorable random',
    fields: [
      { k: 'w', type: 'range', label: 'Words', value: 6, min: 3, max: 12 },
      { k: 'n', type: 'num', label: 'How many', value: 5, min: 1, max: 50 },
      { k: 'sep', type: 'select', label: 'Separator', options: [['-', 'Hyphen'], ['.', 'Dot'], ['_', 'Underscore'], [' ', 'Space']], value: '-' },
      { k: 'cap', type: 'check', label: 'Capitalise each word' },
      { k: 'num', type: 'check', label: 'Add a number' },
    ],
    sample: {},
    run(v) {
      const out = [];
      for (let i = 0; i < Math.min(+v.n || 1, 50); i++) {
        const p = Array.from({ length: +v.w }, () => {
          const w = u.pick(WORDS);
          return v.cap ? w[0].toUpperCase() + w.slice(1) : w;
        });
        if (v.num) p.push(String(u.randInt(100)));
        out.push(p.join(v.sep));
      }
      return [{ text: out.join('\n') }, { kv: [['Word list', `${WORDS.length} words`], ['Entropy', `about ${Math.floor(+v.w * Math.log2(WORDS.length))} bits each`]] }];
    },
  });

  const COMMON = new Set('password 123456 12345678 123456789 1234567890 qwerty qwerty123 abc123 password1 password123 admin admin123 letmein welcome welcome1 monkey dragon iloveyou trustno1 sunshine princess football baseball master login changeme p@ssw0rd passw0rd secret summer winter spring autumn'.split(' '));
  IT.passwordScore = function (p) {
    const pool = (/[a-z]/.test(p) ? 26 : 0) + (/[A-Z]/.test(p) ? 26 : 0) + (/\d/.test(p) ? 10 : 0) + (/[^a-zA-Z0-9]/.test(p) ? 33 : 0);
    let bits = p.length * Math.log2(pool || 1);
    const flags = [];
    const low = p.toLowerCase(), de = low.replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!]/g, 'i').replace(/0/g, 'o').replace(/\$/g, 's').replace(/\d+$/, '');
    if (COMMON.has(low) || COMMON.has(de)) { flags.push('Appears on common password lists'); bits = Math.min(bits, 10); }
    if (/(.)\1{2,}/.test(p)) { flags.push('Repeated characters'); bits *= 0.8; }
    const seqs = ['abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '0123456789'];
    if (seqs.some((s) => { for (let i = 0; i + 4 <= low.length; i++) { const c = low.substr(i, 4); if (s.includes(c) || s.includes([...c].reverse().join(''))) return true; } return false; })) { flags.push('Keyboard or alphabet sequence'); bits *= 0.7; }
    if (/(19|20)\d\d/.test(p)) { flags.push('Contains what looks like a year'); bits -= 8; }
    if (/^[A-Z][a-z]+\d{1,4}[!@#$]?$/.test(p)) { flags.push('Word + number pattern, the first thing crackers try'); bits *= 0.5; }
    return { bits: Math.max(0, bits), flags, pool };
  };
  T({
    id: 'password-strength', name: 'Password Strength Check', cat: 'security', featured: true,
    tags: 'entropy audit crack time policy',
    fields: [{ k: 'p', type: 'password', label: 'Password', reveal: true }],
    sample: { p: 'Summer2024!' },
    run(v) {
      if (!v.p) return null;
      const { bits, flags, pool } = IT.passwordScore(v.p);
      const t = (rate) => { const s = 2 ** bits / 2 / rate; return s > 3.15e13 ? 'Over a million years' : s > 3.15e7 ? `${u.nf(s / 3.15e7, 0)} years` : u.fmtDur(s); };
      const label = bits < 28 ? 'Very weak' : bits < 40 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Very strong';
      return [
        { meter: { label, value: Math.min(bits / 100, 1), text: `about ${Math.round(bits)} bits`, good: true } },
        flags.length ? { note: flags.join('. ') + '.', tone: 'bad' } : null,
        { kv: [['Length', String(v.p.length)], ['Character pool', String(pool)], ['Online attack, 100 guesses/s', t(100)], ['Offline bcrypt, 10 kH/s', t(1e4)], ['Offline MD5/NTLM, 100 GH/s', t(1e11)]] },
      ];
    },
  });

  T({
    id: 'uuid-generator', name: 'UUID / GUID Generator', cat: 'security', regen: true,
    tags: 'guid random unique id identifier',
    fields: [
      { k: 'ver', type: 'seg', label: 'Version', options: ['v4', 'v7'], value: 'v4' },
      { k: 'n', type: 'num', label: 'How many', value: 5, min: 1, max: 500 },
      { k: 'upper', type: 'check', label: 'Uppercase' },
      { k: 'brace', type: 'check', label: 'Windows braces { }' },
    ],
    sample: {},
    run(v) {
      const one = () => {
        const b = u.randBytes(16);
        if (v.ver === 'v7') {
          const t = Date.now();
          for (let i = 0; i < 6; i++) b[i] = Math.floor(t / 2 ** (8 * (5 - i))) & 255;
        }
        b[6] = (b[6] & 0x0f) | (v.ver === 'v7' ? 0x70 : 0x40);
        b[8] = (b[8] & 0x3f) | 0x80;
        const h = hx(b);
        let s = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        if (v.upper) s = s.toUpperCase();
        return v.brace ? `{${s}}` : s;
      };
      return Array.from({ length: Math.min(+v.n || 1, 500) }, one).join('\n');
    },
  });

  T({
    id: 'token-generator', name: 'API Key & Token Generator', cat: 'security', regen: true,
    tags: 'secret random apikey webhook salt nonce',
    fields: [
      { k: 'bytes', type: 'num', label: 'Random bytes', value: 32, min: 4, max: 256 },
      { k: 'fmt', type: 'seg', label: 'Format', options: ['hex', 'base64url', 'alphanumeric'], value: 'base64url' },
      { k: 'pre', type: 'text', label: 'Prefix (optional)', ph: 'itk_', mono: true },
      { k: 'n', type: 'num', label: 'How many', value: 3, min: 1, max: 100 },
    ],
    sample: {},
    run(v) {
      const A = SETS.lower + SETS.upper + SETS.digits;
      const one = () => {
        const n = Math.min(Math.max(+v.bytes || 32, 1), 256);
        if (v.fmt === 'hex') return hx(u.randBytes(n));
        if (v.fmt === 'base64url') return u.b64url(u.randBytes(n));
        return Array.from({ length: Math.ceil((n * 8) / Math.log2(62)) }, () => A[u.randInt(62)]).join('');
      };
      return Array.from({ length: Math.min(+v.n || 1, 100) }, () => v.pre + one()).join('\n');
    },
  });

  // ---------- Hashes ----------
  async function allHashes(b) {
    const [s1, s256, s384, s512] = await Promise.all(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'].map((a) => u.sha(a, b)));
    return [['MD5 (legacy)', hx(u.md5(b))], ['SHA-1 (legacy)', hx(s1)], ['SHA-256', hx(s256)], ['SHA-384', hx(s384)], ['SHA-512', hx(s512)], ['CRC-32', u.crc32(b).toString(16).padStart(8, '0')]];
  }
  T({
    id: 'hash-generator', name: 'Hash Generator', cat: 'security', featured: true,
    tags: 'md5 sha1 sha256 sha512 digest checksum ntlm',
    fields: [{ k: 'x', type: 'area', label: 'Text', rows: 5 }],
    sample: { x: 'The quick brown fox jumps over the lazy dog' },
    async run(v) {
      if (!v.x) return null;
      const utf16 = new Uint8Array(new Uint16Array(Array.from({ length: v.x.length }, (_, i) => v.x.charCodeAt(i))).buffer);
      return { kv: [...(await allHashes(u.utf8(v.x))), ['NTLM', hx(u.md4(utf16))]] };
    },
  });
  T({
    id: 'file-checksum', name: 'File Checksum Verifier', cat: 'security', featured: true,
    tags: 'iso download verify integrity sha256 md5 hash',
    fields: [{ k: 'f', type: 'file', label: 'File' }, { k: 'exp', type: 'text', label: 'Expected hash (optional)', mono: true }],
    async run(v) {
      if (!v.f) return null;
      const kv = await allHashes(v.f.bytes);
      const e = v.exp.trim().toLowerCase().replace(/[\s:-]/g, '');
      const hit = e && kv.find((r) => r[1] === e);
      return [e ? { note: hit ? `Match on ${hit[0]}. The file is intact.` : 'No match. The file differs from the expected hash.', tone: hit ? 'ok' : 'bad' } : null, { kv: [['File', `${v.f.name} (${u.fmtBytes(v.f.bytes.length)})`], ...kv] }];
    },
  });
  T({
    id: 'hmac-generator', name: 'HMAC Generator', cat: 'security',
    tags: 'signature webhook sha256 mac',
    fields: [
      { k: 'x', type: 'area', label: 'Message', rows: 4 }, { k: 'key', type: 'text', label: 'Secret key', mono: true },
      { k: 'alg', type: 'select', label: 'Hash', options: ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'], value: 'SHA-256' },
    ],
    sample: { x: 'what do ya want for nothing?', key: 'Jefe', alg: 'SHA-256' },
    async run(v) {
      if (!v.x || !v.key) return null;
      const m = await u.hmac(v.alg, u.utf8(v.key), u.utf8(v.x));
      return { kv: [['Hex', hx(m)], ['Base64', u.b64(m)]] };
    },
  });
  T({
    id: 'crc-checksum', name: 'CRC-32 / Adler-32', cat: 'security',
    tags: 'crc32 adler32 checksum integrity',
    fields: [{ k: 'x', type: 'area', label: 'Data', rows: 4 }, { k: 'mode', type: 'seg', label: 'Input is', options: ['Text', 'Hex'], value: 'Text' }],
    sample: { x: '123456789', mode: 'Text' },
    run(v) {
      if (!v.x) return null;
      const b = v.mode === 'Hex' ? u.unhex(v.x) : u.utf8(v.x);
      const c = u.crc32(b), a = u.adler32(b);
      return { kv: [['CRC-32 hex', c.toString(16).padStart(8, '0')], ['CRC-32 decimal', String(c)], ['Adler-32 hex', a.toString(16).padStart(8, '0')], ['Adler-32 decimal', String(a)]] };
    },
  });
  T({
    id: 'bcrypt-tool', name: 'Bcrypt Hash & Verify', cat: 'security', manual: true,
    tags: 'password hash blowfish salt',
    fields: [
      { k: 'mode', type: 'seg', label: 'Mode', options: ['Hash', 'Verify'], value: 'Hash' },
      { k: 'p', type: 'password', label: 'Password', reveal: true },
      { k: 'cost', type: 'range', label: 'Cost', value: 10, min: 4, max: 14, show: (v) => v.mode === 'Hash' },
      { k: 'h', type: 'text', label: 'Bcrypt hash', mono: true, show: (v) => v.mode === 'Verify' },
    ],
    sample: { mode: 'Hash', p: 'example-only', cost: 6 },
    async run(v) {
      if (!v.p) return null;
      const bc = globalThis.dcodeIO.bcrypt;
      if (v.mode === 'Verify') {
        const ok = await new Promise((res, rej) => bc.compare(v.p, v.h.trim(), (e, r) => (e ? rej(e) : res(r))));
        return { note: ok ? 'Password matches this hash.' : 'Password does not match.', tone: ok ? 'ok' : 'bad' };
      }
      return new Promise((res, rej) => bc.hash(v.p, +v.cost, (e, r) => (e ? rej(e) : res(r))));
    },
  });

  // Apache MD5-crypt ($apr1$)
  IT.apr1 = function (pw, salt) {
    const p = u.utf8(pw), s = u.utf8(salt), magic = u.utf8('$apr1$');
    const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
    let alt = u.md5(cat(p, s, p));
    const parts = [p, magic, s];
    for (let i = p.length; i > 0; i -= 16) parts.push(alt.subarray(0, Math.min(16, i)));
    for (let i = p.length; i > 0; i >>= 1) parts.push(i & 1 ? new Uint8Array(1) : p.subarray(0, 1));
    let f = u.md5(cat(...parts));
    for (let i = 0; i < 1000; i++) {
      const c = [];
      c.push(i & 1 ? p : f);
      if (i % 3) c.push(s);
      if (i % 7) c.push(p);
      c.push(i & 1 ? f : p);
      f = u.md5(cat(...c));
    }
    const A = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const to = (v, n) => { let r = ''; while (n--) { r += A[v & 63]; v >>= 6; } return r; };
    const out = to((f[0] << 16) | (f[6] << 8) | f[12], 4) + to((f[1] << 16) | (f[7] << 8) | f[13], 4) + to((f[2] << 16) | (f[8] << 8) | f[14], 4) + to((f[3] << 16) | (f[9] << 8) | f[15], 4) + to((f[4] << 16) | (f[10] << 8) | f[5], 4) + to(f[11], 2);
    return `$apr1$${salt}$${out}`;
  };
  T({
    id: 'htpasswd-generator', name: 'htpasswd Generator', cat: 'security', manual: true,
    tags: 'apache nginx basic auth apr1 password file',
    fields: [
      { k: 'user', type: 'text', label: 'Username', mono: true },
      { k: 'p', type: 'password', label: 'Password', reveal: true },
      { k: 'alg', type: 'seg', label: 'Algorithm', options: ['bcrypt', 'apr1', 'SHA-1'], value: 'bcrypt' },
    ],
    sample: { user: 'deploy', p: 'example-only', alg: 'apr1' },
    async run(v) {
      if (!v.user || !v.p) return null;
      if (v.user.includes(':')) throw new Error('A username cannot contain a colon.');
      let h;
      if (v.alg === 'apr1') {
        const A = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        h = IT.apr1(v.p, Array.from({ length: 8 }, () => A[u.randInt(64)]).join(''));
      } else if (v.alg === 'SHA-1') h = '{SHA}' + u.b64(await u.sha('SHA-1', u.utf8(v.p)));
      else h = (await new Promise((res, rej) => globalThis.dcodeIO.bcrypt.hash(v.p, 10, (e, r) => (e ? rej(e) : res(r))))).replace(/^\$2a\$/, '$2y$');
      return `${v.user}:${h}`;
    },
  });
  T({
    id: 'pbkdf2', name: 'PBKDF2 Key Derivation', cat: 'security', manual: true,
    tags: 'kdf derive stretch salt iterations',
    fields: [
      { k: 'p', type: 'text', label: 'Password', mono: true }, { k: 'salt', type: 'text', label: 'Salt', mono: true },
      { k: 'it', type: 'num', label: 'Iterations', value: 600000, min: 1, max: 5000000 }, { k: 'len', type: 'num', label: 'Output bytes', value: 32, min: 1, max: 128 },
      { k: 'alg', type: 'select', label: 'Hash', options: ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'], value: 'SHA-256' },
    ],
    sample: { p: 'password', salt: 'salt', it: 1000, len: 32, alg: 'SHA-256' },
    async run(v) {
      if (!v.p) return null;
      const s = u.subtle();
      const k = await s.importKey('raw', u.utf8(v.p), 'PBKDF2', false, ['deriveBits']);
      const b = new Uint8Array(await s.deriveBits({ name: 'PBKDF2', hash: v.alg, salt: u.utf8(v.salt), iterations: +v.it }, k, +v.len * 8));
      return { kv: [['Hex', hx(b)], ['Base64', u.b64(b)]] };
    },
  });

  // ---------- Symmetric encryption ----------
  async function aesKey(pw, salt) {
    const s = u.subtle();
    const k = await s.importKey('raw', u.utf8(pw), 'PBKDF2', false, ['deriveKey']);
    return s.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  T({
    id: 'aes-encrypt', name: 'AES Text Encryption', cat: 'security', manual: true,
    tags: 'encrypt decrypt secret share cipher gcm',
    fields: [
      { k: 'mode', type: 'seg', label: 'Mode', options: ['Encrypt', 'Decrypt'], value: 'Encrypt' },
      { k: 'x', type: 'area', label: 'Text', rows: 6 },
      { k: 'p', type: 'password', label: 'Passphrase', reveal: true },
    ],
    sample: { mode: 'Encrypt', x: 'Break-glass admin account is in the safe.', p: 'correct-horse-battery-staple' },
    async run(v) {
      if (!v.x.trim() || !v.p) return null;
      const s = u.subtle();
      if (v.mode === 'Encrypt') {
        const salt = u.randBytes(16), iv = u.randBytes(12);
        const ct = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv }, await aesKey(v.p, salt), u.utf8(v.x)));
        const o = new Uint8Array(28 + ct.length);
        o.set(salt); o.set(iv, 16); o.set(ct, 28);
        return u.b64(o);
      }
      const b = u.unb64(v.x);
      if (b.length < 29) throw new Error('That is too short to be ciphertext from this tool.');
      try {
        return u.fromUtf8(new Uint8Array(await s.decrypt({ name: 'AES-GCM', iv: b.subarray(16, 28) }, await aesKey(v.p, b.subarray(0, 16)), b.subarray(28))));
      } catch { throw new Error('Decryption failed. The passphrase is wrong or the text was altered.'); }
    },
  });
  T({
    id: 'keypair-generator', name: 'Key Pair Generator', cat: 'security', manual: true,
    tags: 'rsa ecdsa private public pem pkcs8 spki',
    runLabel: 'Generate',
    fields: [{ k: 'alg', type: 'select', label: 'Type', options: ['RSA 2048', 'RSA 3072', 'RSA 4096', 'ECDSA P-256', 'ECDSA P-384'], value: 'RSA 2048' }],
    sample: { alg: 'ECDSA P-256' },
    async run(v) {
      const s = u.subtle();
      const p = v.alg.startsWith('RSA')
        ? await s.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: +v.alg.slice(4), publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
        : await s.generateKey({ name: 'ECDSA', namedCurve: v.alg.slice(6) }, true, ['sign', 'verify']);
      const pem = (lab, b) => `-----BEGIN ${lab}-----\n${u.b64(new Uint8Array(b)).match(/.{1,64}/g).join('\n')}\n-----END ${lab}-----`;
      return [
        { title: 'Private key (PKCS#8). Keep this safe.', text: pem('PRIVATE KEY', await s.exportKey('pkcs8', p.privateKey)), name: 'private.pem' },
        { title: 'Public key (SPKI)', text: pem('PUBLIC KEY', await s.exportKey('spki', p.publicKey)), name: 'public.pem' },
      ];
    },
  });

  // ---------- JWT ----------
  T({
    id: 'jwt-decoder', name: 'JWT Decoder', cat: 'security', featured: true,
    tags: 'json web token oauth bearer claims exp',
    fields: [{ k: 'x', type: 'area', label: 'Token', rows: 5 }, { k: 'key', type: 'text', label: 'HMAC secret to verify (optional)', mono: true }],
    sample: { x: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', key: 'your-256-bit-secret' },
    async run(v) {
      const t = v.x.trim().replace(/^Bearer\s+/i, '');
      if (!t) return null;
      const p = t.split('.');
      if (p.length < 2) throw new Error('A JWT has three dot-separated parts.');
      const dec = (s) => { try { return JSON.parse(u.fromUtf8(u.unb64(s))); } catch { throw new Error('That token does not decode to JSON.'); } };
      const h = dec(p[0]), c = dec(p[1]);
      const out = [];
      const now = Date.now() / 1000;
      if (h.alg === 'none') out.push({ note: 'This token is unsigned (alg: none). Never accept it.', tone: 'bad' });
      if (typeof c.exp === 'number') out.push({ note: c.exp < now ? `Expired ${u.ago((now - c.exp) * 1000)}.` : `Valid, expires ${u.ago((now - c.exp) * 1000)}.`, tone: c.exp < now ? 'bad' : 'ok' });
      if (v.key && /^HS(256|384|512)$/.test(h.alg)) {
        const sig = await u.hmac('SHA-' + h.alg.slice(2), u.utf8(v.key), u.utf8(`${p[0]}.${p[1]}`));
        const ok = u.b64url(sig) === (p[2] || '').replace(/=+$/, '');
        out.push({ note: ok ? 'Signature verified with that secret.' : 'Signature does not match that secret.', tone: ok ? 'ok' : 'bad' });
      } else if (v.key) out.push({ note: `Verification here supports HS256, HS384 and HS512, not ${h.alg}.`, tone: 'warn' });
      const times = [['iat', 'Issued'], ['nbf', 'Not before'], ['exp', 'Expires']].filter(([k]) => typeof c[k] === 'number').map(([k, l]) => [l, new Date(c[k] * 1000).toISOString()]);
      if (times.length) out.push({ kv: times });
      out.push({ title: 'Header', text: JSON.stringify(h, null, 2) }, { title: 'Payload', text: JSON.stringify(c, null, 2) });
      return out;
    },
  });
  T({
    id: 'jwt-generator', name: 'JWT Generator', cat: 'security',
    tags: 'json web token sign hs256 create',
    fields: [
      { k: 'c', type: 'area', label: 'Payload JSON', rows: 6, value: '{\n  "sub": "1234567890",\n  "name": "Test User"\n}' },
      { k: 'key', type: 'text', label: 'Secret', mono: true },
      { k: 'alg', type: 'select', label: 'Algorithm', options: ['HS256', 'HS384', 'HS512'], value: 'HS256' },
      { k: 'ttl', type: 'num', label: 'Expires in minutes (0 for never)', value: 60, min: 0 },
    ],
    sample: { key: 'example-secret-for-testing-only' },
    async run(v) {
      if (!v.key) return null;
      let c;
      try { c = JSON.parse(v.c); } catch (e) { throw new Error('Payload is not valid JSON: ' + e.message); }
      const now = Math.floor(Date.now() / 1000);
      c.iat = c.iat || now;
      if (+v.ttl) c.exp = c.exp || now + +v.ttl * 60;
      const e = (o) => u.b64url(u.utf8(JSON.stringify(o)));
      const body = `${e({ alg: v.alg, typ: 'JWT' })}.${e(c)}`;
      return `${body}.${u.b64url(await u.hmac('SHA-' + v.alg.slice(2), u.utf8(v.key), u.utf8(body)))}`;
    },
  });

  // ---------- ASN.1 / X.509 ----------
  const OID = {
    '2.5.4.3': 'CN', '2.5.4.5': 'serialNumber', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU', '1.2.840.113549.1.9.1': 'emailAddress', '0.9.2342.19200300.100.1.25': 'DC',
    '1.2.840.113549.1.1.1': 'RSA', '1.2.840.113549.1.1.5': 'SHA-1 with RSA', '1.2.840.113549.1.1.11': 'SHA-256 with RSA', '1.2.840.113549.1.1.12': 'SHA-384 with RSA', '1.2.840.113549.1.1.13': 'SHA-512 with RSA', '1.2.840.113549.1.1.10': 'RSA-PSS',
    '1.2.840.10045.2.1': 'EC', '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521', '1.2.840.10045.4.3.2': 'ECDSA with SHA-256', '1.2.840.10045.4.3.3': 'ECDSA with SHA-384', '1.3.101.112': 'Ed25519',
    '2.5.29.14': 'Subject Key ID', '2.5.29.15': 'Key Usage', '2.5.29.17': 'Subject Alt Names', '2.5.29.19': 'Basic Constraints', '2.5.29.31': 'CRL Distribution', '2.5.29.32': 'Certificate Policies', '2.5.29.35': 'Authority Key ID', '2.5.29.37': 'Extended Key Usage', '1.3.6.1.5.5.7.1.1': 'Authority Info Access', '1.3.6.1.4.1.11129.2.4.2': 'SCT List',
    '1.3.6.1.5.5.7.3.1': 'Server Auth', '1.3.6.1.5.5.7.3.2': 'Client Auth', '1.3.6.1.5.5.7.3.3': 'Code Signing', '1.3.6.1.5.5.7.3.4': 'Email Protection', '1.3.6.1.5.5.7.3.8': 'Time Stamping', '1.3.6.1.5.5.7.3.9': 'OCSP Signing', '1.3.6.1.4.1.311.20.2.2': 'Smartcard Logon',
    '1.2.840.113549.1.9.14': 'Extension Request', '1.2.840.113549.1.7.2': 'PKCS#7 Signed Data',
  };
  const TAGN = { 1: 'BOOLEAN', 2: 'INTEGER', 3: 'BIT STRING', 4: 'OCTET STRING', 5: 'NULL', 6: 'OID', 10: 'ENUM', 12: 'UTF8String', 16: 'SEQUENCE', 17: 'SET', 19: 'PrintableString', 20: 'T61String', 22: 'IA5String', 23: 'UTCTime', 24: 'GeneralizedTime', 30: 'BMPString' };
  function der(b, off, end) {
    off = off || 0; end = end === undefined ? b.length : end;
    const out = [];
    while (off < end) {
      const first = b[off++];
      const cls = first >> 6, cons = !!(first & 0x20);
      let tag = first & 31;
      if (tag === 31) { tag = 0; let x; do { x = b[off++]; tag = tag * 128 + (x & 127); } while (x & 128); }
      let len = b[off++];
      if (len & 128) {
        const n = len & 127;
        if (!n || n > 4) throw new Error('This DER uses a length form that is not supported.');
        len = 0;
        for (let i = 0; i < n; i++) len = len * 256 + b[off++];
      }
      if (off + len > end) throw new Error('This data is truncated or is not DER.');
      const node = { cls, cons, tag, val: b.subarray(off, off + len), start: off, len };
      if (cons) node.kids = der(b, off, off + len);
      out.push(node);
      off += len;
    }
    return out;
  }
  const oidStr = (v) => {
    const a = [Math.min(Math.floor(v[0] / 40), 2)];
    a.push(v[0] - a[0] * 40);
    let n = 0;
    for (let i = 1; i < v.length; i++) {
      n = n * 128 + (v[i] & 127);
      if (!(v[i] & 128)) { a.push(n); n = 0; }
    }
    return a.join('.');
  };
  const str = (n) => (n.tag === 30 ? String.fromCharCode(...Array.from({ length: n.val.length >> 1 }, (_, i) => (n.val[i * 2] << 8) | n.val[i * 2 + 1])) : u.fromUtf8(n.val));
  const dnOf = (n) => n.kids.flatMap((set) => set.kids.map((a) => `${OID[oidStr(a.kids[0].val)] || oidStr(a.kids[0].val)}=${str(a.kids[1])}`)).join(', ');
  const timeOf = (n) => {
    const s = u.fromUtf8(n.val);
    const m = n.tag === 23 ? /^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?Z$/.exec(s) : /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?Z$/.exec(s);
    if (!m) return new Date(NaN);
    const y = n.tag === 23 ? (+m[1] < 50 ? 2000 : 1900) + +m[1] : +m[1];
    return new Date(Date.UTC(y, +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
  };
  const intBits = (v) => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; let top = v[i], b = 0; while (top) { b++; top >>= 1; } return (v.length - i - 1) * 8 + b; };
  function spkiText(n) {
    const algo = oidStr(n.kids[0].kids[0].val);
    if (OID[algo] === 'RSA') {
      const k = der(n.kids[1].val.subarray(1))[0];
      return `RSA ${intBits(k.kids[0].val)} bit`;
    }
    if (OID[algo] === 'EC') return `EC ${OID[oidStr(n.kids[0].kids[1].val)] || 'unknown curve'}`;
    return OID[algo] || algo;
  }
  function extensions(seq) {
    const out = [];
    const sans = [];
    for (const e of seq.kids) {
      const id = oidStr(e.kids[0].val), crit = e.kids[1].tag === 1 && e.kids[1].val[0] !== 0;
      const body = e.kids[e.kids.length - 1].val;
      let txt = '';
      try {
        const n = der(body)[0];
        if (id === '2.5.29.17') {
          for (const g of n.kids) {
            if (g.tag === 2) sans.push('DNS:' + u.fromUtf8(g.val));
            else if (g.tag === 1) sans.push('Email:' + u.fromUtf8(g.val));
            else if (g.tag === 6) sans.push('URI:' + u.fromUtf8(g.val));
            else if (g.tag === 7) sans.push('IP:' + (g.val.length === 4 ? [...g.val].join('.') : u.ipv6Short(BigInt('0x' + hx(g.val)))));
          }
          txt = sans.join('\n');
        } else if (id === '2.5.29.37') txt = n.kids.map((k) => OID[oidStr(k.val)] || oidStr(k.val)).join(', ');
        else if (id === '2.5.29.19') {
          const ca = n.kids && n.kids[0] && n.kids[0].tag === 1 && n.kids[0].val[0] !== 0;
          txt = ca ? 'CA: yes' : 'CA: no';
        } else if (id === '2.5.29.15') {
          const names = ['Digital Signature', 'Non Repudiation', 'Key Encipherment', 'Data Encipherment', 'Key Agreement', 'Cert Sign', 'CRL Sign'];
          txt = names.filter((_, i) => n.val[1] & (128 >> i)).join(', ');
        } else if (id === '2.5.29.14') txt = hx(n.val);
        else if (id === '1.3.6.1.5.5.7.1.1') txt = n.kids.map((a) => `${oidStr(a.kids[0].val).endsWith('.1') ? 'OCSP' : 'CA Issuers'}: ${u.fromUtf8(a.kids[1].val)}`).join('\n');
        else if (id === '2.5.29.31') txt = (u.fromUtf8(body).match(/https?:\/\/[\x21-\x7e]+/g) || []).join('\n');
        else txt = `${body.length} bytes`;
      } catch { txt = `${body.length} bytes`; }
      out.push([(OID[id] || id) + (crit ? ' (critical)' : ''), txt]);
    }
    return { kv: out, sans };
  }
  function pemBlocks(s) {
    const m = [...String(s).matchAll(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g)];
    if (m.length) return m.map((x) => ({ label: x[1], der: u.unb64(x[2]) }));
    const t = String(s).trim();
    return t ? [{ label: '', der: /^[0-9a-f\s:]+$/i.test(t) ? u.unhex(t) : u.unb64(t) }] : [];
  }
  IT.parseCert = function (d) {
    const c = der(d)[0];
    if (!c || !c.kids || c.kids.length < 3 || !c.kids[0].kids) throw new Error('This is not an X.509 certificate.');
    const t = c.kids[0].kids;
    let i = 0;
    let version = 1;
    if (t[0].cls === 2 && t[0].tag === 0) { version = t[0].kids[0].val[0] + 1; i = 1; }
    const serial = t[i], issuer = t[i + 2], val = t[i + 3], subject = t[i + 4], spki = t[i + 5];
    const ext = t.find((x) => x.cls === 2 && x.tag === 3);
    const e = ext ? extensions(ext.kids[0]) : { kv: [], sans: [] };
    return { version, serial: hx(serial.val), issuer: dnOf(issuer), subject: dnOf(subject), notBefore: timeOf(val.kids[0]), notAfter: timeOf(val.kids[1]), key: spkiText(spki), sig: OID[oidStr(c.kids[1].kids[0].val)] || oidStr(c.kids[1].kids[0].val), ext: e.kv, sans: e.sans };
  };
  IT.parseCSR = function (d) {
    const c = der(d)[0];
    if (!c || !c.kids || !c.kids[0].kids) throw new Error('This is not a PKCS#10 request.');
    const t = c.kids[0].kids;
    const attrs = t.find((x) => x.cls === 2 && x.tag === 0);
    let e = { kv: [], sans: [] };
    if (attrs && attrs.kids) for (const a of attrs.kids) if (OID[oidStr(a.kids[0].val)] === 'Extension Request') e = extensions(a.kids[1].kids[0]);
    return { subject: dnOf(t[1]), key: spkiText(t[2]), sig: OID[oidStr(c.kids[1].kids[0].val)] || '-', ext: e.kv, sans: e.sans };
  };
  const fp = (b) => hx(b).toUpperCase().match(/../g).join(':');
  const CERT_S = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIJAOJPlffv+gWoMA0GCSqGSIb3DQEBCwUAMD8xCzAJBgNVBAYTAkdCMRQw
EgYDVQQKEwtFeGFtcGxlIExhYjEaMBgGA1UEAxMRdG9vbHMuZXhhbXBsZS5jb20wHhcNMjYwMTAx
MDAwMDAwWhcNMzYwMTAxMDAwMDAwWjA/MQswCQYDVQQGEwJHQjEUMBIGA1UEChMLRXhhbXBsZSBM
YWIxGjAYBgNVBAMTEXRvb2xzLmV4YW1wbGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEArZ8FdyzJlwxLUlG6ngvm/rJ04i6kumohrckcpBAZKhJytonnMDewXz+pHU1lkyF1iLiR
oG0i03rckxmA1NCCYXq0rG4nuBKyRAzciP7dUQDhixhZCg7jnBMN2p8pq92HKC3CV6zSdJ3z6MrN
dTr6MEycZ6OCL0XGL6zEPh2nziCPyL1SbLW0kA1IC0lE5JkZam9I+V5GR6xhjUPHNu3P0fMUCXJI
HmNS/8FTPPVzGuayWxEqXVtjaaxGHeg3TrInEhTsUl56CAoyYOgeXYgJeSn57PBrsVeCBN0mM00w
BpVdklgIAarJrt/tqI3GsGsFs/eEFRTAqwm6j+kHRTfzWQIDAQABo2owaDAzBgNVHREELDAqghF0
b29scy5leGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29thwTAAAIKMBMGA1UdJQQMMAoGCCsGAQUF
BwMBMAwGA1UdEwEB/wQCMAAwDgYDVR0PAQH/BAQDAgWgMA0GCSqGSIb3DQEBCwUAA4IBAQBlBVmV
xomEEujU3pNJrNWBBxhMo/Z2MRgLmuc57+aFCXSx23wAX4H+n7OCpewNgfswE2Tv8ColHtPyw8yc
tUwsRrICpF8XTYIW29L4ZFkDXvmGF8BfEwVMR+A7WitCflujAFEd/45Kicz20DL0MftJgZwXS9E0
ev2eU2fkNlUbUtWfM4YVc9LaDqGzpRPVpURbciw0MN8DDMOaajNPBN03U8MfncFreCxwlwGCCE2a
47AZXre7CBYU3xtpHh6HCwEfzr+TJCNXGka3n/9ULaS2n5Y1MX1BM3NqphfQQzLpJn4YVKcB+DMY
v4rzMyrHkPYSgev/L2WzHXblliSjFNnY
-----END CERTIFICATE-----`;
  const CSR_S = `-----BEGIN CERTIFICATE REQUEST-----
MIIC/TCCAeUCAQAwPzELMAkGA1UEBhMCR0IxFDASBgNVBAoTC0V4YW1wbGUgTGFiMRowGAYDVQQD
ExF0b29scy5leGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAK2fBXcs
yZcMS1JRup4L5v6ydOIupLpqIa3JHKQQGSoScraJ5zA3sF8/qR1NZZMhdYi4kaBtItN63JMZgNTQ
gmF6tKxuJ7gSskQM3Ij+3VEA4YsYWQoO45wTDdqfKavdhygtwles0nSd8+jKzXU6+jBMnGejgi9F
xi+sxD4dp84gj8i9Umy1tJANSAtJROSZGWpvSPleRkesYY1Dxzbtz9HzFAlySB5jUv/BUzz1cxrm
slsRKl1bY2msRh3oN06yJxIU7FJeeggKMmDoHl2ICXkp+ezwa7FXggTdJjNNMAaVXZJYCAGqya7f
7aiNxrBrBbP3hBUUwKsJuo/pB0U381kCAwEAAaB5MHcGCSqGSIb3DQEJDjFqMGgwMwYDVR0RBCww
KoIRdG9vbHMuZXhhbXBsZS5jb22CD3d3dy5leGFtcGxlLmNvbYcEwAACCjATBgNVHSUEDDAKBggr
BgEFBQcDATAMBgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQEAwIFoDANBgkqhkiG9w0BAQsFAAOCAQEA
KJyEuvp36DgWdJaEHxUJZdk25s2rl37hU8ZbeexcypT/maLA0zT9QILcP6eVWraDAvxrUIbicIF2
Lx96od4k9sFFo/p5EwDpvtVVdODsH9NovnOm1vDWuABwo1FyKWRHSg3wSxOo5YZnCpIWQfM/mfVx
tA/CiEaKsiCD9ksElIN0kkQEB3hr7Wak1RsMRjkToTEBRFoUFJgN9xqnikJO9mzs2co9N8/cP/I9
AX45UvP2x1jQ8TA8u2Jkfv4UZqzWY8U0UTGQwvlP8U+MWxehEkHbI/prtDMs0THEB57H1gSwVNJo
dVW+15GLCt10x7sSJ+bTaEPU2wzvOEqg+0hSrQ==
-----END CERTIFICATE REQUEST-----`;
  T({
    id: 'certificate-decoder', name: 'Certificate Decoder', cat: 'security', featured: true,
    tags: 'x509 ssl tls pem cer crt expiry san fingerprint chain',
    fields: [{ k: 'x', type: 'area', label: 'PEM certificate(s)', rows: 10, ph: '-----BEGIN CERTIFICATE-----' }],
    sample: { x: CERT_S },
    async run(v) {
      const blocks = pemBlocks(v.x);
      if (!blocks.length) return null;
      const out = [];
      for (const b of blocks) {
        if (b.label && !/CERTIFICATE$/.test(b.label) ) throw new Error(`This is a ${b.label} block. Use the matching tool for it.`);
        const c = IT.parseCert(b.der);
        const now = Date.now();
        const days = Math.round((c.notAfter - now) / 86400000);
        out.push(
          { note: c.notAfter < now ? `Expired ${-days} days ago.` : c.notBefore > now ? 'Not valid yet.' : `Valid for another ${days} days.`, tone: c.notAfter < now || c.notBefore > now ? 'bad' : days < 30 ? 'warn' : 'ok' },
          { kv: [['Subject', c.subject], ['Issuer', c.issuer], ['Self-signed', c.subject === c.issuer ? 'Yes' : 'No'], ['Valid from', c.notBefore.toISOString()], ['Valid to', c.notAfter.toISOString()], ['Public key', c.key], ['Signature', c.sig], ['Serial', c.serial], ['Version', 'v' + c.version], ['SHA-256 fingerprint', fp(await u.sha('SHA-256', b.der))], ['SHA-1 thumbprint', fp(await u.sha('SHA-1', b.der))], ...c.ext] }
        );
      }
      return out;
    },
  });
  T({
    id: 'csr-decoder', name: 'CSR Decoder', cat: 'security',
    tags: 'pkcs10 certificate request subject san',
    fields: [{ k: 'x', type: 'area', label: 'PEM CSR', rows: 10, ph: '-----BEGIN CERTIFICATE REQUEST-----' }],
    sample: { x: CSR_S },
    run(v) {
      const b = pemBlocks(v.x)[0];
      if (!b) return null;
      const c = IT.parseCSR(b.der);
      return { kv: [['Subject', c.subject], ['Public key', c.key], ['Signature', c.sig], ...c.ext] };
    },
  });
  T({
    id: 'asn1-viewer', name: 'ASN.1 / DER Viewer', cat: 'security',
    tags: 'der ber pem structure parse',
    fields: [{ k: 'x', type: 'area', label: 'PEM, Base64 or hex', rows: 8 }],
    sample: { x: '3015020101301006072a8648ce3d020106052b81040022' },
    run(v) {
      const b = pemBlocks(v.x)[0];
      if (!b) return null;
      const lines = [];
      const walk = (n, depth) => {
        const name = n.cls === 0 ? TAGN[n.tag] || `tag ${n.tag}` : n.cls === 2 ? `[${n.tag}]` : `class ${n.cls} tag ${n.tag}`;
        let val = '';
        if (!n.cons && n.cls === 0) {
          if (n.tag === 6) { const o = oidStr(n.val); val = o + (OID[o] ? ` (${OID[o]})` : ''); }
          else if ([12, 19, 20, 22, 23, 24].includes(n.tag)) val = u.fromUtf8(n.val);
          else if (n.tag === 1) val = n.val[0] ? 'TRUE' : 'FALSE';
          else if (n.val.length) val = hx(n.val.subarray(0, 24)) + (n.val.length > 24 ? '…' : '');
        }
        lines.push(`${'  '.repeat(depth)}${name} (${n.len} bytes)${val ? ' ' + val : ''}`);
        (n.kids || []).forEach((k) => walk(k, depth + 1));
      };
      der(b.der).forEach((n) => walk(n, 0));
      return lines.join('\n');
    },
  });

  T({
    id: 'ssh-key-fingerprint', name: 'SSH Key Fingerprint', cat: 'security',
    tags: 'openssh authorized_keys sha256 md5 ed25519 rsa',
    fields: [{ k: 'x', type: 'area', label: 'Public key(s)', rows: 6, ph: 'ssh-ed25519 AAAA... user@host' }],
    sample: { x: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGb9ECWmEzf6FQbrBZ9w7lshQhqowtrbLDFw4rXAxZuE alice@laptop' },
    async run(v) {
      const rows = [];
      for (const l of u.lines(v.x).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))) {
        const m = /(ssh-(?:rsa|ed25519|dss)|ecdsa-sha2-\S+|sk-\S+)\s+([A-Za-z0-9+/=]+)\s*(.*)$/.exec(l);
        if (!m) throw new Error(`Not an OpenSSH public key: ${l.slice(0, 40)}…`);
        const b = u.unb64(m[2]);
        const dv = new DataView(b.buffer, b.byteOffset, b.length);
        const fields = [];
        for (let o = 0; o + 4 <= b.length;) { const n = dv.getUint32(o); fields.push(b.subarray(o + 4, o + 4 + n)); o += 4 + n; }
        const t = u.fromUtf8(fields[0] || new Uint8Array());
        if (t !== m[1]) throw new Error('The key type does not match the encoded data.');
        const bits = t === 'ssh-rsa' ? intBits(fields[2]) : t === 'ssh-ed25519' ? 256 : t.startsWith('ecdsa') ? +t.replace(/\D+/g, '') : 1024;
        rows.push([t, bits, 'SHA256:' + u.b64(await u.sha('SHA-256', b)).replace(/=+$/, ''), hx(u.md5(b)).match(/../g).join(':'), m[3] || '-']);
      }
      return rows.length ? { table: { head: ['Type', 'Bits', 'SHA-256', 'MD5', 'Comment'], rows } } : null;
    },
  });

  // ---------- OTP ----------
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  u.b32enc = (b) => {
    let bits = 0, val = 0, o = '';
    for (const x of b) {
      val = (val << 8) | x; bits += 8;
      while (bits >= 5) { o += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
      val &= (1 << bits) - 1;
    }
    if (bits) o += B32[(val << (5 - bits)) & 31];
    return o.padEnd(Math.ceil(o.length / 8) * 8, '=');
  };
  u.b32dec = (s) => {
    const c = s.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0, val = 0;
    const o = [];
    for (const ch of c) {
      const i = B32.indexOf(ch);
      if (i < 0) throw new Error('That is not valid Base32.');
      val = (val << 5) | i; bits += 5;
      if (bits >= 8) { o.push((val >>> (bits - 8)) & 255); bits -= 8; }
      val &= (1 << bits) - 1;
    }
    return new Uint8Array(o);
  };
  IT.totp = async function (secret, t, digits, period, alg) {
    const c = Math.floor(t / period), m = new Uint8Array(8);
    new DataView(m.buffer).setUint32(0, Math.floor(c / 4294967296));
    new DataView(m.buffer).setUint32(4, c >>> 0);
    const h = await u.hmac(alg || 'SHA-1', secret, m);
    const o = h[h.length - 1] & 15;
    const n = new DataView(h.buffer, h.byteOffset).getUint32(o) & 0x7fffffff;
    return String(n % 10 ** digits).padStart(digits, '0');
  };
  T({
    id: 'totp-generator', name: 'TOTP / 2FA Code', cat: 'security', tick: 1000,
    tags: 'otp mfa 2fa authenticator rfc6238',
    fields: [
      { k: 's', type: 'text', label: 'Base32 secret', mono: true, ph: 'JBSWY3DPEHPK3PXP' },
      { k: 'd', type: 'seg', label: 'Digits', options: ['6', '8'], value: '6' },
      { k: 'p', type: 'seg', label: 'Period', options: ['30', '60'], value: '30' },
    ],
    sample: { s: 'JBSWY3DPEHPK3PXP' },
    async run(v) {
      if (!v.s.trim()) return null;
      const now = Date.now() / 1000, p = +v.p, left = p - Math.floor(now % p);
      const k = u.b32dec(v.s);
      return [
        { big: await IT.totp(k, now, +v.d, p) },
        { meter: { label: 'Time left', value: left / p, text: `${left} s`, good: true } },
        { kv: [['Next code', await IT.totp(k, now + p, +v.d, p)]] },
      ];
    },
  });

  // ---------- Cisco type 7 ----------
  const X7 = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';
  IT.type7 = {
    decode(h) {
      const c = h.trim();
      if (!/^\d\d([0-9a-f]{2})+$/i.test(c)) throw new Error('Type 7 strings are an even length of hex digits.');
      const s = +c.slice(0, 2);
      let o = '';
      for (let i = 2, j = 0; i < c.length; i += 2, j++) o += String.fromCharCode(parseInt(c.substr(i, 2), 16) ^ X7.charCodeAt((s + j) % X7.length));
      return o;
    },
    encode(p, s) {
      let o = u.pad(s);
      for (let i = 0; i < p.length; i++) o += (p.charCodeAt(i) ^ X7.charCodeAt((s + i) % X7.length)).toString(16).padStart(2, '0').toUpperCase();
      return o;
    },
  };
  T({
    id: 'cisco-type7', name: 'Cisco Type 7 Decoder', cat: 'security',
    tags: 'ios password service encryption reverse config',
    fields: [
      { k: 'mode', type: 'seg', label: 'Mode', options: ['Decode', 'Encode'], value: 'Decode' },
      { k: 'x', type: 'text', label: 'Value', mono: true },
    ],
    sample: { mode: 'Decode', x: '0822455D0A16' },
    run(v) {
      if (!v.x.trim()) return null;
      return v.mode === 'Decode' ? IT.type7.decode(v.x) : IT.type7.encode(v.x, 9);
    },
  });

  // ---------- Investigate tools that belong with the crypto ----------
  const SECRETS = [
    ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED |DSA )?PRIVATE KEY-----/g],
    ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
    ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
    ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
    ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
    ['Azure storage key', /AccountKey=[A-Za-z0-9+/=]{40,}/g],
    ['JSON Web Token', /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]+/g],
    ['Bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g],
    ['Password assignment', /\b(?:password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*["']?[^\s"',;]{4,}/gi],
    ['URL with credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@[^\s/]+/gi],
  ];
  T({
    id: 'secret-scanner', name: 'Secret Scanner', cat: 'soc',
    tags: 'credentials leak token redact sanitize mask',
    fields: [{ k: 'x', type: 'area', label: 'Text to check', rows: 10 }],
    sample: { x: 'db_url=postgres://app:hunter2@db01/prod\naws_key = AKIAIOSFODNN7EXAMPLE\npassword: Winter2026\nretries=5' },
    run(v) {
      if (!v.x.trim()) return null;
      const rows = [];
      let clean = v.x;
      for (const [name, re] of SECRETS) {
        for (const m of v.x.match(re) || []) {
          rows.push([name, m.length > 12 ? m.slice(0, 6) + '…' : '…']);
          clean = clean.split(m).join(`[REDACTED ${name}]`);
        }
      }
      return rows.length
        ? [{ note: `${rows.length} likely secret(s) found. Rotate anything that has already been shared.`, tone: 'bad' }, { table: { head: ['Type', 'Starts with'], rows } }, { title: 'Redacted copy', text: clean }]
        : { note: 'Nothing matched the known patterns. That is not proof the text is clean.', tone: 'ok' };
    },
  });

  const CV = { AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }, AC: { L: 0.77, H: 0.44 }, UI: { N: 0.85, R: 0.62 }, CIA: { H: 0.56, L: 0.22, N: 0 } };
  IT.cvss = function (m) {
    const ch = m.S === 'C';
    const pr = { N: 0.85, L: ch ? 0.68 : 0.62, H: ch ? 0.5 : 0.27 }[m.PR];
    const iss = 1 - (1 - CV.CIA[m.C]) * (1 - CV.CIA[m.I]) * (1 - CV.CIA[m.A]);
    const imp = ch ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss;
    const ex = 8.22 * CV.AV[m.AV] * CV.AC[m.AC] * pr * CV.UI[m.UI];
    const up = (x) => { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; };
    return imp <= 0 ? 0 : up(Math.min((ch ? 1.08 : 1) * (imp + ex), 10));
  };
  T({
    id: 'cvss-calculator', name: 'CVSS 3.1 Calculator', cat: 'soc',
    tags: 'vulnerability severity risk score base',
    fields: [
      { k: 'AV', type: 'select', label: 'Attack vector', options: [['N', 'Network'], ['A', 'Adjacent'], ['L', 'Local'], ['P', 'Physical']], value: 'N' },
      { k: 'AC', type: 'seg', label: 'Attack complexity', options: [['L', 'Low'], ['H', 'High']], value: 'L' },
      { k: 'PR', type: 'seg', label: 'Privileges required', options: [['N', 'None'], ['L', 'Low'], ['H', 'High']], value: 'N' },
      { k: 'UI', type: 'seg', label: 'User interaction', options: [['N', 'None'], ['R', 'Required']], value: 'N' },
      { k: 'S', type: 'seg', label: 'Scope', options: [['U', 'Unchanged'], ['C', 'Changed']], value: 'U' },
      { k: 'C', type: 'seg', label: 'Confidentiality', options: [['N', 'None'], ['L', 'Low'], ['H', 'High']], value: 'H' },
      { k: 'I', type: 'seg', label: 'Integrity', options: [['N', 'None'], ['L', 'Low'], ['H', 'High']], value: 'H' },
      { k: 'A', type: 'seg', label: 'Availability', options: [['N', 'None'], ['L', 'Low'], ['H', 'High']], value: 'H' },
    ],
    sample: {},
    run(v) {
      const s = IT.cvss(v);
      const lab = s === 0 ? 'None' : s < 4 ? 'Low' : s < 7 ? 'Medium' : s < 9 ? 'High' : 'Critical';
      return [{ big: u.nf(s, 1).replace(/^(\d+)$/, '$1.0') + ' ' + lab }, { title: 'Vector', text: `CVSS:3.1/AV:${v.AV}/AC:${v.AC}/PR:${v.PR}/UI:${v.UI}/S:${v.S}/C:${v.C}/I:${v.I}/A:${v.A}` }];
    },
  });
})();
