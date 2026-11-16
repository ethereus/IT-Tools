(function () {
  'use strict';
  const { tool, ref, u } = IT;
  const T = tool, ip4 = u.fmtIPv4;

  // ---------- The original tool from this repo ----------
  IT.routerConvert = function (input) {
    if (input < 10) return { out: input + 50, rule: 'Below 10: add 50' };
    if (input > 10 && input < 100) return { out: input, rule: '11 to 99: unchanged' };
    if (input > 300 && input < 500) return { out: input - 200, rule: '301 to 499: subtract 200' };
    if (input > 500) {
      const t = input - 300;
      return t > 255 ? { out: t - 100, rule: 'Above 555: subtract 400' } : { out: t, rule: '501 to 555: subtract 300' };
    }
    if (input >= 100 && input < 200) return { out: input - 100, rule: '100 to 199: subtract 100' };
    return { out: null, rule: 'No conversion applied' };
  };
  T({
    id: 'router-converter', name: 'Router Converter', cat: 'network', featured: true, original: true,
    tags: 'number convert router legacy original',
    fields: [{ k: 'nums', type: 'area', label: 'Numbers, one per line', ph: '42', rows: 8 }],
    sample: { nums: '5\n42\n150\n350\n520\n900' },
    run(v) {
      const rows = u.tokens(v.nums).map((t) => {
        const n = parseFloat(t);
        if (isNaN(n)) return [t, 'Not a number', '-'];
        const r = IT.routerConvert(n);
        return [t, r.out === null ? 'No conversion' : String(r.out), r.rule];
      });
      if (!rows.length) return null;
      return [
        { kv: rows.length === 1 ? [['Converted number', rows[0][1]], ['Rule applied', rows[0][2]]] : null, table: rows.length > 1 ? { head: ['Input', 'Converted', 'Rule applied'], rows } : null },
      ];
    },
  });

  // ---------- IPv4 ----------
  T({
    id: 'subnet-calculator', name: 'IPv4 Subnet Calculator', cat: 'network', featured: true,
    tags: 'cidr netmask wildcard broadcast hosts network range',
    fields: [{ k: 'cidr', type: 'text', label: 'Address and prefix or mask', ph: '192.168.10.34/26', mono: true }],
    sample: { cidr: '192.168.10.34/26' },
    run(v) {
      if (!v.cidr.trim()) return null;
      const c = u.parseCIDR(v.cidr);
      const p31 = c.prefix >= 31;
      const cls = (() => {
        const o = Math.floor(c.ip / 16777216);
        return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D (multicast)' : 'E (reserved)';
      })();
      return [
        { bits: { value: c.ip, width: 32, prefix: c.prefix } },
        {
          kv: [
            ['Network', `${ip4(c.net)}/${c.prefix}`], ['Netmask', ip4(c.mask)], ['Wildcard mask', ip4(~c.mask >>> 0)],
            ['Broadcast', p31 ? 'None for this prefix' : ip4(c.bcast)],
            ['First host', ip4(p31 ? c.net : c.net + 1)], ['Last host', ip4(p31 ? c.bcast : c.bcast - 1)],
            ['Usable hosts', u.nf(u.usable(c.prefix), 0)], ['Total addresses', u.nf(c.size, 0)],
            ['Address type', u.ipv4Type(c.ip)], ['Legacy class', cls],
            ['Decimal', String(c.ip)], ['Hex', '0x' + c.ip.toString(16).padStart(8, '0')],
          ],
        },
      ];
    },
  });

  T({
    id: 'cidr-convert', name: 'CIDR / Mask Converter', cat: 'network',
    tags: 'netmask wildcard prefix slash notation',
    fields: [{ k: 'x', type: 'text', label: 'Prefix, netmask or wildcard', ph: '/23, 255.255.254.0 or 0.0.1.255', mono: true }],
    sample: { x: '255.255.254.0' },
    run(v) {
      const s = v.x.trim().replace(/^\//, '');
      if (!s) return null;
      let p;
      if (/^\d{1,2}$/.test(s)) p = +s;
      else {
        const n = u.parseIPv4(s);
        p = -1;
        for (let i = 0; i <= 32; i++) {
          if (u.maskOf(i) === n) p = i;
          else if (p < 0 && (~u.maskOf(i) >>> 0) === n) p = i;
        }
        if (p < 0) throw new Error('That is neither a contiguous mask nor a wildcard.');
      }
      if (p > 32) throw new Error('A prefix must be 0 to 32.');
      return { kv: [['Prefix', '/' + p], ['Netmask', ip4(u.maskOf(p))], ['Wildcard', ip4(~u.maskOf(p) >>> 0)], ['Addresses', u.nf(2 ** (32 - p), 0)], ['Usable hosts', u.nf(u.usable(p), 0)]] };
    },
  });

  T({
    id: 'vlsm-planner', name: 'VLSM Planner', cat: 'network', featured: true,
    tags: 'variable length subnet mask allocation design plan',
    fields: [
      { k: 'net', type: 'text', label: 'Base network', ph: '10.20.0.0/22', mono: true },
      { k: 'req', type: 'area', label: 'Subnets needed: name and host count, one per line', rows: 7, ph: 'Sales 120' },
    ],
    sample: { net: '10.20.0.0/22', req: 'Sales 120\nEngineering 60\nVoice 200\nManagement 12\nUplink 2' },
    run(v) {
      if (!v.net.trim() || !v.req.trim()) return null;
      const base = u.parseCIDR(v.net);
      const need = u.lines(v.req).map((l) => l.trim()).filter(Boolean).map((l, i) => {
        const m = /^(.*?)[\s:,=]*(\d+)$/.exec(l);
        if (!m) throw new Error(`Line ${i + 1} needs a host count: "${l}"`);
        return { name: m[1].trim() || `Subnet ${i + 1}`, hosts: +m[2] };
      }).sort((a, b) => b.hosts - a.hosts);
      let cur = base.net;
      const rows = [];
      for (const n of need) {
        let p = 30;
        while (p > 0 && 2 ** (32 - p) - 2 < n.hosts) p--;
        const size = 2 ** (32 - p);
        cur = Math.ceil(cur / size) * size;
        if (cur + size - 1 > base.bcast) throw new Error(`${ip4(base.net)}/${base.prefix} runs out of room at "${n.name}" (${n.hosts} hosts). Use a bigger block.`);
        const first = p >= 31 ? cur : cur + 1, last = p >= 31 ? cur + size - 1 : cur + size - 2;
        rows.push([n.name, n.hosts, `${ip4(cur)}/${p}`, ip4(u.maskOf(p)), `${ip4(first)} - ${ip4(last)}`, u.nf(u.usable(p), 0)]);
        cur += size;
      }
      const used = cur - base.net;
      return [
        { table: { head: ['Subnet', 'Needed', 'Network', 'Mask', 'Usable range', 'Usable'], rows } },
        { meter: { label: 'Block allocated', value: used / base.size, text: `${u.nf(used, 0)} of ${u.nf(base.size, 0)} addresses` } },
      ];
    },
  });

  T({
    id: 'subnet-splitter', name: 'Subnet Splitter', cat: 'network',
    tags: 'divide carve subnetting equal',
    fields: [
      { k: 'net', type: 'text', label: 'Network', ph: '172.16.0.0/20', mono: true },
      { k: 'p', type: 'num', label: 'New prefix length', min: 1, max: 32, value: 24 },
    ],
    sample: { net: '172.16.0.0/20', p: 24 },
    run(v) {
      if (!v.net.trim()) return null;
      const c = u.parseCIDR(v.net), p = +v.p;
      if (!(p >= c.prefix && p <= 32)) throw new Error(`The new prefix must be between /${c.prefix} and /32.`);
      const size = 2 ** (32 - p), count = 2 ** (p - c.prefix), show = Math.min(count, 2048), rows = [];
      for (let i = 0; i < show; i++) {
        const n = c.net + i * size;
        rows.push([i + 1, `${ip4(n)}/${p}`, size > 2 ? ip4(n + 1) : ip4(n), size > 2 ? ip4(n + size - 2) : ip4(n + size - 1), size > 2 ? ip4(n + size - 1) : '-']);
      }
      return { table: { head: ['#', 'Subnet', 'First host', 'Last host', 'Broadcast'], rows }, note: `${u.nf(count, 0)} subnets of /${p}, ${u.nf(u.usable(p), 0)} usable hosts each` + (show < count ? `. Showing the first ${show}.` : '') };
    },
  });

  T({
    id: 'range-to-cidr', name: 'IP Range to CIDR', cat: 'network',
    tags: 'firewall acl block range start end',
    fields: [{ k: 'a', type: 'text', label: 'Start address', ph: '10.0.0.5', mono: true }, { k: 'b', type: 'text', label: 'End address', ph: '10.0.0.77', mono: true }],
    sample: { a: '10.0.0.5', b: '10.0.0.77' },
    run(v) {
      if (!v.a.trim() || !v.b.trim()) return null;
      const a = u.parseIPv4(v.a), b = u.parseIPv4(v.b);
      if (a > b) throw new Error('The start address must not be above the end address.');
      return { text: u.rangeToCidrs(a, b).join('\n'), title: `${u.nf(b - a + 1, 0)} addresses` };
    },
  });

  T({
    id: 'cidr-aggregator', name: 'CIDR Aggregator', cat: 'network',
    tags: 'summarize summarise supernet route summary merge dedupe',
    fields: [{ k: 'list', type: 'area', label: 'Addresses or CIDR blocks', rows: 9, ph: '192.168.0.0/24\n192.168.1.0/24' }],
    sample: { list: '192.168.0.0/24\n192.168.1.0/24\n192.168.2.0/23\n10.1.1.1\n10.1.1.2\n10.1.1.3' },
    run(v) {
      const n = u.tokens(v.list).map(u.parseCIDR).map((c) => [c.net, c.bcast]).sort((a, b) => a[0] - b[0]);
      if (!n.length) return null;
      const merged = [];
      for (const [a, b] of n) {
        const l = merged[merged.length - 1];
        if (l && a <= l[1] + 1) l[1] = Math.max(l[1], b);
        else merged.push([a, b]);
      }
      const out = merged.flatMap(([a, b]) => u.rangeToCidrs(a, b));
      return { text: out.join('\n'), title: `${n.length} in, ${out.length} out` };
    },
  });

  T({
    id: 'ip-in-subnet', name: 'IP in Subnet Checker', cat: 'network',
    tags: 'contains member match lookup',
    fields: [
      { k: 'ips', type: 'area', label: 'Addresses', rows: 6, ph: '10.1.2.3' },
      { k: 'nets', type: 'area', label: 'Subnets', rows: 6, ph: '10.0.0.0/8' },
    ],
    sample: { ips: '10.1.2.3\n192.168.5.9\n8.8.8.8', nets: '10.0.0.0/8\n192.168.0.0/16\n10.1.2.0/24' },
    run(v) {
      const nets = u.tokens(v.nets).map((s) => ({ s, c: u.parseCIDR(s) })).sort((a, b) => b.c.prefix - a.c.prefix);
      const rows = u.tokens(v.ips).map((s) => {
        const n = u.parseIPv4(s);
        const hits = nets.filter((x) => n >= x.c.net && n <= x.c.bcast);
        return [s, hits.length ? hits[0].s : 'No match', hits.length > 1 ? hits.slice(1).map((h) => h.s).join(', ') : '-'];
      });
      return rows.length ? { table: { head: ['Address', 'Most specific match', 'Also inside'], rows } } : null;
    },
  });

  T({
    id: 'ipv4-converter', name: 'IPv4 Converter', cat: 'network',
    tags: 'decimal hex binary integer long ptr dotted',
    fields: [{ k: 'x', type: 'text', label: 'Address (dotted, decimal, 0x hex or 32-bit binary)', ph: '192.0.2.235', mono: true }],
    sample: { x: '192.0.2.235' },
    run(v) {
      const s = v.x.trim();
      if (!s) return null;
      let n;
      if (/^[01]{32}$/.test(s.replace(/[\s.]/g, ''))) n = parseInt(s.replace(/[\s.]/g, ''), 2);
      else if (/^0x[0-9a-f]{1,8}$/i.test(s)) n = parseInt(s, 16);
      else if (/^\d+$/.test(s)) {
        n = +s;
        if (n > 4294967295) throw new Error('That is larger than a 32-bit address.');
      } else n = u.parseIPv4(s);
      const d = ip4(n);
      return { kv: [['Dotted', d], ['Decimal', String(n)], ['Hex', '0x' + n.toString(16).padStart(8, '0').toUpperCase()], ['Binary', d.split('.').map((o) => (+o).toString(2).padStart(8, '0')).join('.')], ['Octal', d.split('.').map((o) => (+o).toString(8).padStart(4, '0')).join('.')], ['PTR name', d.split('.').reverse().join('.') + '.in-addr.arpa'], ['Type', u.ipv4Type(n)]] };
    },
  });

  // ---------- IPv6 ----------
  T({
    id: 'ipv6-analyzer', name: 'IPv6 Expander & Analyzer', cat: 'network', featured: true,
    tags: 'compress canonical rfc5952 expand ip6.arpa',
    fields: [{ k: 'x', type: 'text', label: 'IPv6 address, optionally with a prefix', ph: '2001:db8::8a2e:370:7334/64', mono: true }],
    sample: { x: '2001:db8::8a2e:370:7334/64' },
    run(v) {
      if (!v.x.trim()) return null;
      const c = u.parseV6CIDR(v.x);
      return { kv: [['Compressed', u.ipv6Short(c.ip)], ['Expanded', u.ipv6Full(c.ip)], ['Type', u.ipv6Type(c.ip)], ['Network', `${u.ipv6Short(c.net)}/${c.prefix}`], ['First address', u.ipv6Full(c.net)], ['Last address', u.ipv6Full(c.last)], ['Addresses', (1n << c.hostBits).toLocaleString('en-US')], ['PTR name', u.ip6Arpa(c.ip)]] };
    },
  });

  T({
    id: 'ipv6-subnets', name: 'IPv6 Subnet Calculator', cat: 'network',
    tags: 'prefix delegation allocation split',
    fields: [
      { k: 'net', type: 'text', label: 'Allocation', ph: '2001:db8:abcd::/48', mono: true },
      { k: 'p', type: 'num', label: 'New prefix length', value: 56, min: 1, max: 128 },
      { k: 'start', type: 'num', label: 'Start at subnet number', value: 0, min: 0 },
    ],
    sample: { net: '2001:db8:abcd::/48', p: 56, start: 0 },
    run(v) {
      if (!v.net.trim()) return null;
      const c = u.parseV6CIDR(v.net), p = +v.p;
      if (!(p >= c.prefix && p <= 128)) throw new Error(`The new prefix must be between /${c.prefix} and /128.`);
      const count = 1n << BigInt(p - c.prefix), step = 1n << BigInt(128 - p), rows = [];
      const s = BigInt(Math.max(0, Math.floor(+v.start || 0)));
      if (s >= count) throw new Error(`Only ${count.toLocaleString('en-US')} subnets exist at this size.`);
      for (let i = s; i < s + 64n && i < count; i++) {
        const n = c.net + i * step;
        rows.push([i.toString(), `${u.ipv6Short(n)}/${p}`, u.ipv6Short(n + step - 1n)]);
      }
      return { table: { head: ['#', 'Prefix', 'Last address'], rows }, note: `${count.toLocaleString('en-US')} subnets available. Showing up to 64 at a time.` };
    },
  });

  T({
    id: 'ipv4-to-ipv6', name: 'IPv4 to IPv6 Mappings', cat: 'network',
    tags: 'transition mapped 6to4 nat64 dual stack',
    fields: [{ k: 'x', type: 'text', label: 'IPv4 address', ph: '192.0.2.33', mono: true }],
    sample: { x: '192.0.2.33' },
    run(v) {
      if (!v.x.trim()) return null;
      const n = u.parseIPv4(v.x);
      const h = n.toString(16).padStart(8, '0'), hi = h.slice(0, 4), lo = h.slice(4);
      const s = (t) => u.ipv6Short(u.parseIPv6(t));
      return { kv: [['IPv4-mapped', `::ffff:${ip4(n)}`], ['IPv4-mapped (hex)', s(`::ffff:${hi}:${lo}`)], ['NAT64 (RFC 6052)', s(`64:ff9b::${hi}:${lo}`)], ['6to4 prefix', s(`2002:${hi}:${lo}::`) + '/48'], ['ISATAP interface ID', `::5efe:${ip4(n)}`]] };
    },
  });

  // ---------- MAC ----------
  T({
    id: 'mac-formatter', name: 'MAC Address Formatter', cat: 'network',
    tags: 'colon hyphen dot cisco format bulk',
    fields: [
      { k: 'macs', type: 'area', label: 'MAC addresses', rows: 6, ph: '00-1A-2B-3C-4D-5E' },
      { k: 'fmt', type: 'select', label: 'Format', options: [['colon', 'aa:bb:cc:dd:ee:ff (Linux)'], ['dash', 'AA-BB-CC-DD-EE-FF (Windows)'], ['dot', 'aabb.ccdd.eeff (Cisco)'], ['bare', 'aabbccddeeff']], value: 'colon' },
      { k: 'upper', type: 'check', label: 'Uppercase' },
    ],
    sample: { macs: '00-1A-2B-3C-4D-5E\n001a.2b3c.4d5f\nAABBCCDDEEFF', fmt: 'colon' },
    run(v) {
      const r = u.lines(v.macs).map((l) => l.trim()).filter(Boolean).map((l) => {
        const c = u.parseMac(l);
        let o = v.fmt === 'colon' ? c.match(/../g).join(':') : v.fmt === 'dash' ? c.match(/../g).join('-').toUpperCase() : v.fmt === 'dot' ? c.match(/.{4}/g).join('.') : c;
        return v.upper ? o.toUpperCase() : o;
      });
      return r.length ? r.join('\n') : null;
    },
  });

  const VIRT = { '005056': 'VMware', '000c29': 'VMware', '000569': 'VMware', '00155d': 'Microsoft Hyper-V', '080027': 'Oracle VirtualBox', '00163e': 'Xen', '525400': 'QEMU / KVM', '001c42': 'Parallels', 'b827eb': 'Raspberry Pi', 'dca632': 'Raspberry Pi', 'e45f01': 'Raspberry Pi' };
  T({
    id: 'mac-inspector', name: 'MAC Inspector', cat: 'network',
    tags: 'oui vendor locally administered multicast vmware hyper-v randomized private',
    fields: [{ k: 'x', type: 'text', label: 'MAC address', ph: '00:50:56:ab:cd:ef', mono: true }],
    sample: { x: '00:50:56:ab:cd:ef' },
    run(v) {
      if (!v.x.trim()) return null;
      const c = u.parseMac(v.x), first = parseInt(c.slice(0, 2), 16), oui = c.slice(0, 6);
      const broadcast = c === 'ffffffffffff', local = !!(first & 2), multi = !!(first & 1);
      return { kv: [['Normalised', c.match(/../g).join(':')], ['OUI prefix', oui.match(/../g).join(':').toUpperCase()], ['Cast', broadcast ? 'Broadcast' : multi ? 'Multicast' : 'Unicast'], ['Administration', local ? 'Locally administered (often a randomised Wi-Fi MAC or VM)' : 'Universally administered (burned in)'], ['Platform match', VIRT[oui] || 'Not in the built-in list of virtual and Pi prefixes']] };
    },
  });

  T({
    id: 'mac-to-eui64', name: 'MAC to EUI-64', cat: 'network',
    tags: 'slaac link-local fe80 interface id',
    fields: [{ k: 'x', type: 'text', label: 'MAC address', ph: '00:1a:2b:3c:4d:5e', mono: true }, { k: 'pfx', type: 'text', label: 'Global prefix (optional)', ph: '2001:db8:1:2::/64', mono: true }],
    sample: { x: '00:1a:2b:3c:4d:5e', pfx: '2001:db8:1:2::/64' },
    run(v) {
      if (!v.x.trim()) return null;
      const c = u.parseMac(v.x);
      const f = (parseInt(c.slice(0, 2), 16) ^ 2).toString(16).padStart(2, '0');
      const e = f + c.slice(2, 6) + 'fffe' + c.slice(6);
      const g = e.match(/.{4}/g);
      const iid = BigInt('0x' + e);
      const kv = [['Modified EUI-64', g.join(':')], ['Link-local', u.ipv6Short(u.parseIPv6(`fe80::${g.join(':')}`))]];
      if (v.pfx.trim()) {
        const p = u.parseV6CIDR(v.pfx);
        if (p.prefix > 64) throw new Error('SLAAC needs a prefix of /64 or shorter.');
        kv.push(['SLAAC address', u.ipv6Short(p.net | iid)]);
      }
      return { kv };
    },
  });

  T({
    id: 'mac-generator', name: 'Random MAC Generator', cat: 'network',
    tags: 'random lab virtual',
    fields: [{ k: 'n', type: 'num', label: 'How many', value: 5, min: 1, max: 500 }, { k: 'pre', type: 'text', label: 'Fixed prefix (optional)', ph: '02:42', mono: true }],
    sample: { n: 5, pre: '' },
    regen: true,
    run(v) {
      const pre = v.pre.replace(/[^0-9a-f]/gi, '').toLowerCase();
      if (pre.length > 10 || pre.length % 2) throw new Error('The prefix needs a whole number of bytes.');
      const out = [];
      for (let i = 0; i < Math.min(+v.n || 0, 500); i++) {
        const b = u.hex(u.randBytes(6));
        let m = (pre + b.slice(pre.length)).padEnd(12, '0');
        if (!pre) m = ((parseInt(m.slice(0, 2), 16) & 0xfc) | 2).toString(16).padStart(2, '0') + m.slice(2);
        out.push(m.match(/../g).join(':'));
      }
      return out.join('\n');
    },
  });

  // ---------- Reference ----------
  const P = (s) => s.split('|');
  const PORTS = `20|TCP|FTP data
21|TCP|FTP control
22|TCP|SSH, SCP, SFTP
23|TCP|Telnet (cleartext)
25|TCP|SMTP
43|TCP|WHOIS
49|TCP|TACACS+
53|TCP/UDP|DNS
67|UDP|DHCP server
68|UDP|DHCP client
69|UDP|TFTP
80|TCP|HTTP
88|TCP/UDP|Kerberos
110|TCP|POP3
123|UDP|NTP
135|TCP|Microsoft RPC endpoint mapper
137|UDP|NetBIOS name service
138|UDP|NetBIOS datagram
139|TCP|NetBIOS session
143|TCP|IMAP
161|UDP|SNMP
162|UDP|SNMP trap
179|TCP|BGP
389|TCP/UDP|LDAP
443|TCP/UDP|HTTPS and QUIC
445|TCP|SMB
464|TCP/UDP|Kerberos password change
465|TCP|SMTP over TLS
500|UDP|IKE (IPsec)
514|UDP|Syslog
515|TCP|LPD printing
520|UDP|RIP
546|UDP|DHCPv6 client
547|UDP|DHCPv6 server
554|TCP/UDP|RTSP
587|TCP|SMTP submission
623|UDP|IPMI
631|TCP|IPP printing
636|TCP|LDAPS
853|TCP|DNS over TLS
873|TCP|rsync
902|TCP|VMware ESXi host agent
989|TCP|FTPS data
990|TCP|FTPS control
993|TCP|IMAPS
995|TCP|POP3S
1194|UDP|OpenVPN
1433|TCP|Microsoft SQL Server
1434|UDP|SQL Server Browser
1521|TCP|Oracle database
1645|UDP|RADIUS auth (legacy)
1646|UDP|RADIUS accounting (legacy)
1701|UDP|L2TP
1723|TCP|PPTP
1812|UDP|RADIUS authentication
1813|UDP|RADIUS accounting
1883|TCP|MQTT
2049|TCP/UDP|NFS
2222|TCP|Common alternate SSH
2375|TCP|Docker API (unencrypted)
2376|TCP|Docker API over TLS
3128|TCP|Squid proxy
3260|TCP|iSCSI
3268|TCP|AD Global Catalog
3269|TCP|AD Global Catalog over TLS
3306|TCP|MySQL and MariaDB
3389|TCP/UDP|Remote Desktop (RDP)
3478|UDP|STUN and TURN
4500|UDP|IPsec NAT traversal
5060|TCP/UDP|SIP
5061|TCP|SIP over TLS
5353|UDP|mDNS
5432|TCP|PostgreSQL
5671|TCP|AMQP over TLS
5672|TCP|AMQP
5900|TCP|VNC
5985|TCP|WinRM over HTTP
5986|TCP|WinRM over HTTPS
6379|TCP|Redis
6443|TCP|Kubernetes API
6514|TCP|Syslog over TLS
8006|TCP|Proxmox VE web UI
8080|TCP|Common alternate HTTP
8443|TCP|Common alternate HTTPS
8530|TCP|WSUS over HTTP
8531|TCP|WSUS over HTTPS
9000|TCP|Portainer, SonarQube and others
9090|TCP|Prometheus
9100|TCP|Raw printing (JetDirect)
9200|TCP|Elasticsearch
10000|TCP|Webmin and NDMP
10050|TCP|Zabbix agent
10051|TCP|Zabbix server
11211|TCP/UDP|Memcached
15672|TCP|RabbitMQ management
27017|TCP|MongoDB
51820|UDP|WireGuard`.split('\n').map(P);
  ref({ id: 'port-reference', name: 'Port Reference', cat: 'infra', featured: true, tags: 'tcp udp service firewall well known', ph: 'rdp, 443, sql…', head: ['Port', 'Protocol', 'Service'], rows: PORTS });

  ref({
    id: 'special-ip-ranges', name: 'Special IP Ranges', cat: 'network',
    tags: 'rfc1918 bogon reserved private apipa cgnat',
    head: ['Range', 'Purpose', 'RFC'],
    rows: `0.0.0.0/8|Current network|1122
10.0.0.0/8|Private|1918
100.64.0.0/10|Carrier-grade NAT|6598
127.0.0.0/8|Loopback|1122
169.254.0.0/16|Link-local (APIPA)|3927
172.16.0.0/12|Private|1918
192.0.0.0/24|IETF protocol assignments|6890
192.0.2.0/24|Documentation TEST-NET-1|5737
192.88.99.0/24|6to4 relay anycast (deprecated)|7526
192.168.0.0/16|Private|1918
198.18.0.0/15|Benchmarking|2544
198.51.100.0/24|Documentation TEST-NET-2|5737
203.0.113.0/24|Documentation TEST-NET-3|5737
224.0.0.0/4|Multicast|5771
240.0.0.0/4|Reserved|1112
255.255.255.255/32|Limited broadcast|919
::/128|Unspecified|4291
::1/128|Loopback|4291
::ffff:0:0/96|IPv4-mapped|4291
64:ff9b::/96|NAT64|6052
2001::/32|Teredo|4380
2001:db8::/32|Documentation|3849
2002::/16|6to4|3056
fc00::/7|Unique local|4193
fe80::/10|Link-local|4291
ff00::/8|Multicast|4291`.split('\n').map(P),
  });

  ref({
    id: 'dscp-reference', name: 'DSCP / ToS Reference', cat: 'infra',
    tags: 'qos cos priority ef af',
    head: ['Name', 'DSCP', 'ToS byte', 'Binary', 'Typical use'],
    rows: `CS0 / BE|0|0|000000|Best effort
CS1|8|32|001000|Scavenger
AF11|10|40|001010|High-throughput data
AF12|12|48|001100|High-throughput data
AF13|14|56|001110|High-throughput data
CS2|16|64|010000|Network operations
AF21|18|72|010010|Low-latency data
AF22|20|80|010100|Low-latency data
AF23|22|88|010110|Low-latency data
CS3|24|96|011000|Call signalling
AF31|26|104|011010|Multimedia streaming
AF32|28|112|011100|Multimedia streaming
AF33|30|120|011110|Multimedia streaming
CS4|32|128|100000|Real-time interactive
AF41|34|136|100010|Video conferencing
AF42|36|144|100100|Video conferencing
AF43|38|152|100110|Video conferencing
CS5|40|160|101000|Broadcast video and signalling
EF|46|184|101110|Voice bearer
CS6|48|192|110000|Network control
CS7|56|224|111000|Reserved`.split('\n').map(P),
  });

  ref({
    id: 'ethernet-reference', name: 'Ethernet & Cabling', cat: 'infra',
    tags: 'cat5e cat6 cat6a fibre fiber om3 om4 os2 poe 802.3at distance',
    head: ['Type', 'Speed', 'Distance / power', 'Notes'],
    rows: `Cat5e|1 Gb/s|100 m|Bandwidth 100 MHz
Cat6|1 Gb/s, 10 Gb/s|100 m, 55 m|Bandwidth 250 MHz
Cat6a|10 Gb/s|100 m|Bandwidth 500 MHz
Cat7|10 Gb/s|100 m|Shielded, not a TIA standard
Cat8|25 to 40 Gb/s|30 m|Data centre runs
OM1 (MMF)|1 Gb/s, 10 Gb/s|275 m, 33 m|62.5 micron
OM2 (MMF)|1 Gb/s, 10 Gb/s|550 m, 82 m|50 micron
OM3 (MMF)|10 Gb/s, 40 Gb/s|300 m, 100 m|Laser optimised
OM4 (MMF)|10 Gb/s, 100 Gb/s|400 m, 100 m|Laser optimised
OM5 (MMF)|100 Gb/s SWDM|150 m|Wideband
OS2 (SMF)|Up to 400 Gb/s and beyond|Tens of km|Optic dependent
802.3af (PoE)|Type 1|15.4 W at PSE, 12.95 W at PD|Phones, simple APs
802.3at (PoE+)|Type 2|30 W at PSE, 25.5 W at PD|APs, PTZ cameras
802.3bt (PoE++)|Type 3|60 W at PSE, 51 W at PD|Multi-radio APs
802.3bt (PoE++)|Type 4|90 W at PSE, 71.3 W at PD|Displays, thin clients
T568B pinout|Pins 1 to 8|W-O, O, W-G, B, W-B, G, W-Br, Br|Common in new patching
T568A pinout|Pins 1 to 8|W-G, G, W-O, B, W-B, O, W-Br, Br|A on one end, B on other makes a crossover`.split('\n').map(P),
  });

  ref({
    id: 'wifi-channels', name: 'Wi-Fi Channel Reference', cat: 'infra',
    tags: 'wireless frequency 2.4ghz 5ghz dfs channel',
    head: ['Channel', 'Band', 'Centre (MHz)', 'Notes'],
    rows: [
      ...Array.from({ length: 13 }, (_, i) => [String(i + 1), '2.4 GHz', String(2412 + i * 5), [0, 5, 10].includes(i) ? 'Non-overlapping at 20 MHz' : '-']),
      ['14', '2.4 GHz', '2484', 'Japan, 802.11b only'],
      ...[36, 40, 44, 48].map((c) => [String(c), '5 GHz', String(5000 + c * 5), 'UNII-1']),
      ...[52, 56, 60, 64].map((c) => [String(c), '5 GHz', String(5000 + c * 5), 'UNII-2, DFS']),
      ...[100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144].map((c) => [String(c), '5 GHz', String(5000 + c * 5), 'UNII-2 extended, DFS']),
      ...[149, 153, 157, 161, 165].map((c) => [String(c), '5 GHz', String(5000 + c * 5), 'UNII-3']),
    ],
  });

  // ---------- Calculators ----------
  const RATE = { 'Kbps': 1e3, 'Mbps': 1e6, 'Gbps': 1e9 };
  const SIZE = { MB: 1e6, GB: 1e9, TB: 1e12, MiB: 2 ** 20, GiB: 2 ** 30, TiB: 2 ** 40 };
  T({
    id: 'transfer-time', name: 'Transfer Time Calculator', cat: 'infra', featured: true,
    tags: 'bandwidth download copy migration replication speed duration',
    fields: [
      { k: 'size', type: 'num', label: 'Data size', value: 500, min: 0, step: 'any' },
      { k: 'su', type: 'select', label: 'Size unit', options: Object.keys(SIZE), value: 'GB' },
      { k: 'rate', type: 'num', label: 'Link speed', value: 100, min: 0, step: 'any' },
      { k: 'ru', type: 'select', label: 'Speed unit', options: Object.keys(RATE), value: 'Mbps' },
      { k: 'oh', type: 'num', label: 'Overhead %', value: 10, min: 0, max: 95 },
    ],
    sample: { size: 500, su: 'GB', rate: 100, ru: 'Mbps', oh: 10 },
    run(v) {
      const bits = v.size * SIZE[v.su] * 8, bps = v.rate * RATE[v.ru] * (1 - v.oh / 100);
      if (!(bits > 0 && bps > 0)) return null;
      const s = bits / bps;
      return { kv: [['Estimated time', u.fmtDur(s)], ['Effective throughput', `${u.nf(bps / 1e6, 2)} Mbps (${u.fmtBytes(bps / 8, 1000)}/s)`], ['Moved per hour', u.fmtBytes((bps / 8) * 3600, 1000)], ['Moved per day', u.fmtBytes((bps / 8) * 86400, 1000)]] };
    },
  });

  const RATES = [['bps', 1], ['Kbps', 1e3], ['Mbps', 1e6], ['Gbps', 1e9], ['Tbps', 1e12], ['B/s', 8], ['KB/s', 8e3], ['MB/s', 8e6], ['GB/s', 8e9], ['KiB/s', 8192], ['MiB/s', 8 * 2 ** 20], ['GiB/s', 8 * 2 ** 30]];
  T({
    id: 'data-rate-converter', name: 'Data Rate Converter', cat: 'infra',
    tags: 'mbps mb/s bandwidth throughput convert',
    fields: [{ k: 'x', type: 'num', label: 'Value', value: 1000, step: 'any', min: 0 }, { k: 'unit', type: 'select', label: 'Unit', options: RATES.map((r) => r[0]), value: 'Mbps' }],
    sample: { x: 1000, unit: 'Mbps' },
    run(v) {
      const b = v.x * RATES.find((r) => r[0] === v.unit)[1];
      return { kv: RATES.map(([n, f]) => [n, u.nf(b / f, 6)]) };
    },
  });

  T({
    id: 'bdp-calculator', name: 'TCP Throughput / BDP', cat: 'infra',
    tags: 'latency rtt window size wan throughput tcp tuning',
    fields: [
      { k: 'bw', type: 'num', label: 'Link bandwidth (Mbps)', value: 1000, min: 0, step: 'any' },
      { k: 'rtt', type: 'num', label: 'Round trip time (ms)', value: 40, min: 0, step: 'any' },
      { k: 'win', type: 'num', label: 'Current TCP window (KB)', value: 64, min: 0, step: 'any' },
    ],
    sample: { bw: 1000, rtt: 40, win: 64 },
    run(v) {
      if (!(v.bw > 0 && v.rtt > 0)) return null;
      const bdp = (v.bw * 1e6 * (v.rtt / 1000)) / 8;
      const cap = v.win > 0 ? (v.win * 1000 * 8) / (v.rtt / 1000) / 1e6 : 0;
      return { kv: [['Bandwidth-delay product', u.fmtBytes(bdp, 1000)], ['Window needed for line rate', u.fmtBytes(bdp, 1024)], ['Max throughput at current window', u.nf(Math.min(cap, v.bw), 2) + ' Mbps'], ['Link utilisation', u.nf((Math.min(cap, v.bw) / v.bw) * 100, 1) + '%']] };
    },
  });

  const OVER = { none: ['None', 0], pppoe: ['PPPoE', 8], gre: ['GRE', 24], ipip: ['IP-in-IP', 20], vxlan: ['VXLAN', 50], wg4: ['WireGuard over IPv4', 60], wg6: ['WireGuard over IPv6', 80], ipsec: ['IPsec ESP tunnel, AES-GCM (typical)', 58], gretap: ['GRE over IPsec (typical)', 82], mpls: ['MPLS, 2 labels', 8] };
  T({
    id: 'mtu-calculator', name: 'MTU / MSS Calculator', cat: 'infra',
    tags: 'mss vpn tunnel fragmentation ipsec vxlan wireguard pppoe df',
    fields: [
      { k: 'mtu', type: 'num', label: 'Underlying MTU', value: 1500, min: 576, max: 9216 },
      { k: 'enc', type: 'select', label: 'Encapsulation', options: Object.entries(OVER).map(([k, a]) => [k, a[0]]), value: 'ipsec' },
      { k: 'ip', type: 'seg', label: 'Inner IP version', options: [['4', 'IPv4'], ['6', 'IPv6']], value: '4' },
    ],
    sample: { mtu: 1500, enc: 'ipsec', ip: '4' },
    run(v) {
      const o = OVER[v.enc][1], inner = v.mtu - o, hdr = v.ip === '6' ? 40 : 20, icmp = hdr + 8, mss = inner - hdr - 20;
      return { kv: [['Encapsulation overhead', o + ' bytes'], ['Effective MTU', inner + ' bytes'], ['TCP MSS clamp', mss + ' bytes'], ['Largest ping payload', inner - icmp + ' bytes'], ['Windows test', v.ip === '6' ? `ping -l ${inner - icmp} <target>` : `ping -f -l ${inner - icmp} <target>`], ['Linux test', `ping -M do -s ${inner - icmp} <target>`]] };
    },
  });

  T({
    id: 'poe-budget', name: 'PoE Budget Calculator', cat: 'infra',
    tags: 'power switch watts access point phone camera',
    fields: [
      { k: 'budget', type: 'num', label: 'Switch PoE budget (W)', value: 370, min: 0 },
      { k: 'list', type: 'area', label: 'Devices: count, watts each, name', rows: 6, ph: '24 7 IP phones' },
    ],
    sample: { budget: 370, list: '24 7 IP phones\n8 25.5 Access points\n4 15.4 Cameras' },
    run(v) {
      const rows = u.lines(v.list).map((l) => l.trim()).filter(Boolean).map((l) => {
        const m = /^(\d+)\s+([\d.]+)\s*w?\s*(.*)$/i.exec(l);
        if (!m) throw new Error(`Use the format: count watts name. Could not read "${l}"`);
        return [m[3] || 'Device', +m[1], +m[2], +m[1] * +m[2]];
      });
      if (!rows.length) return null;
      const total = rows.reduce((a, r) => a + r[3], 0), pct = v.budget > 0 ? total / v.budget : 1;
      return [
        { meter: { label: 'Budget used', value: pct, text: `${u.nf(total, 1)} W of ${v.budget} W` } },
        { note: pct > 1 ? `Over budget by ${u.nf(total - v.budget, 1)} W.` : pct > 0.8 ? 'This fits, but leaves less than 20% headroom.' : `${u.nf(v.budget - total, 1)} W of headroom.`, tone: pct > 1 ? 'bad' : pct > 0.8 ? 'warn' : 'ok' },
        { table: { head: ['Device', 'Count', 'Watts each', 'Total W'], rows: rows.map((r) => [r[0], r[1], r[2], u.nf(r[3], 1)]) } },
      ];
    },
  });

  // ---------- Config generators ----------
  T({
    id: 'cisco-acl', name: 'Cisco ACL Builder', cat: 'infra',
    tags: 'access list ios firewall permit deny wildcard',
    fields: [
      { k: 'name', type: 'text', label: 'ACL name', value: 'EDGE-IN', mono: true },
      { k: 'act', type: 'seg', label: 'Action', options: ['permit', 'deny'], value: 'permit' },
      { k: 'proto', type: 'select', label: 'Protocol', options: ['tcp', 'udp', 'icmp', 'ip'], value: 'tcp' },
      { k: 'src', type: 'text', label: 'Source (CIDR or any)', value: '10.0.0.0/24', mono: true },
      { k: 'dst', type: 'text', label: 'Destination (CIDR or any)', value: 'any', mono: true },
      { k: 'port', type: 'text', label: 'Destination ports', value: '443 8443', mono: true, show: (v) => v.proto === 'tcp' || v.proto === 'udp' },
      { k: 'log', type: 'check', label: 'Log matches' },
    ],
    sample: {},
    run(v) {
      const host = (s) => {
        s = s.trim();
        if (/^any$/i.test(s)) return 'any';
        const c = u.parseCIDR(s);
        return c.prefix === 32 ? `host ${ip4(c.net)}` : `${ip4(c.net)} ${ip4(~c.mask >>> 0)}`;
      };
      const ports = /tcp|udp/.test(v.proto) ? u.tokens(v.port) : [];
      const base = `${v.act} ${v.proto} ${host(v.src)} ${host(v.dst)}`;
      const lines = (ports.length ? ports.map((p) => `${base} eq ${p}`) : [base]).map((l) => ' ' + l + (v.log ? ' log' : ''));
      return `ip access-list extended ${v.name}\n${lines.join('\n')}`;
    },
  });

  T({
    id: 'cisco-port-config', name: 'Switchport Config Generator', cat: 'infra',
    tags: 'cisco ios interface vlan trunk access portfast bpduguard voice',
    fields: [
      { k: 'ifs', type: 'text', label: 'Interface range', value: 'GigabitEthernet1/0/1 - 24', mono: true },
      { k: 'mode', type: 'seg', label: 'Mode', options: ['access', 'trunk'], value: 'access' },
      { k: 'vlan', type: 'num', label: 'Access VLAN', value: 10, min: 1, max: 4094, show: (v) => v.mode === 'access' },
      { k: 'voice', type: 'num', label: 'Voice VLAN (0 for none)', value: 110, min: 0, max: 4094, show: (v) => v.mode === 'access' },
      { k: 'allowed', type: 'text', label: 'Allowed VLANs', value: '10,20,110', mono: true, show: (v) => v.mode === 'trunk' },
      { k: 'native', type: 'num', label: 'Native VLAN', value: 999, min: 1, max: 4094, show: (v) => v.mode === 'trunk' },
      { k: 'desc', type: 'text', label: 'Description', value: 'User access' },
      { k: 'harden', type: 'check', label: 'PortFast, BPDU guard and port security', value: true, show: (v) => v.mode === 'access' },
    ],
    sample: {},
    run(v) {
      const r = v.ifs.includes(' - ') ? 'interface range ' : 'interface ';
      const l = [r + v.ifs.trim(), ` description ${v.desc}`];
      if (v.mode === 'access') {
        l.push(' switchport mode access', ` switchport access vlan ${v.vlan}`);
        if (+v.voice) l.push(` switchport voice vlan ${v.voice}`);
        if (v.harden) l.push(' spanning-tree portfast', ' spanning-tree bpduguard enable', ' switchport port-security', ` switchport port-security maximum ${+v.voice ? 3 : 2}`, ' switchport port-security violation restrict', ' switchport port-security aging time 10');
      } else {
        l.push(' switchport mode trunk', ` switchport trunk native vlan ${v.native}`, ` switchport trunk allowed vlan ${v.allowed}`, ' switchport nonegotiate');
      }
      l.push(' no shutdown');
      return l.join('\n');
    },
  });

  T({
    id: 'net-diagnostics', name: 'Network Test Commands', cat: 'infra', featured: true,
    tags: 'ping traceroute nslookup dig test-netconnection port check powershell bash mtr',
    fields: [
      { k: 'host', type: 'text', label: 'Target host or IP', value: 'example.com', mono: true },
      { k: 'port', type: 'num', label: 'TCP port', value: 443, min: 1, max: 65535 },
    ],
    sample: {},
    run(v) {
      const h = v.host.trim();
      if (!/^[a-z0-9.:_-]+$/i.test(h)) throw new Error('Enter a plain hostname or IP address.');
      return [
        { title: 'Windows (PowerShell)', text: `Test-Connection ${h} -Count 4\nTest-NetConnection ${h} -Port ${v.port} -InformationLevel Detailed\nTest-NetConnection ${h} -TraceRoute\nResolve-DnsName ${h}\nGet-NetIPConfiguration\nipconfig /flushdns` },
        { title: 'Linux and macOS', text: `ping -c 4 ${h}\nnc -zv ${h} ${v.port}\ntraceroute ${h}\nmtr -rwc 20 ${h}\ndig +short ${h}\ncurl -vkI https://${h}:${v.port}\nopenssl s_client -connect ${h}:${v.port} -servername ${h} </dev/null` },
      ];
    },
  });
})();
