// walkthrough/smtp-stub.cjs
// 最小 SMTP 服务端（只为验证用）：支持 EHLO / AUTH PLAIN·LOGIN / MAIL / RCPT / DATA / QUIT。
// 用它跑通「配置 -> 认证 -> 发信」的真实链路，而不是只验证「报错文案对不对」。
const net = require('net');

const PORT = Number(process.env.STUB_PORT || 2525);
const USER = 'noreply@example.com';
const PASS = 'stub-pass-123';

const received = []; // { from, to, body }

function start() {
  const server = net.createServer((sock) => {
    let buf = '';
    let inData = false;
    let envelope = {};
    let authStep = null;
    let authUser = '';

    sock.write('220 stub.local ESMTP ready\r\n');

    const handle = (line) => {
      const cmd = (line.split(' ')[0] || '').toUpperCase();

      if (cmd === 'EHLO' || cmd === 'HELO') {
        sock.write('250-stub.local\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
      } else if (cmd === 'AUTH') {
        const mech = (line.split(/\s+/)[1] || '').toUpperCase();
        if (mech === 'PLAIN') {
          const arg = line.split(/\s+/)[2];
          if (arg) return finishPlain(arg);
          sock.write('334 \r\n');
          authStep = 'plain';
        } else {
          sock.write('334 VXNlcm5hbWU6\r\n'); // base64("Username:")
          authStep = 'user';
        }
      } else if (authStep === 'plain') {
        finishPlain(line.trim());
      } else if (authStep === 'user') {
        authUser = Buffer.from(line.trim(), 'base64').toString('utf8');
        sock.write('334 UGFzc3dvcmQ6\r\n'); // base64("Password:")
        authStep = 'pass';
      } else if (authStep === 'pass') {
        const p = Buffer.from(line.trim(), 'base64').toString('utf8');
        const ok = authUser === USER && p === PASS;
        sock.write(ok ? '235 2.7.0 Authentication successful\r\n' : '535 5.7.8 Authentication failed\r\n');
        authStep = null;
      } else if (cmd === 'MAIL') {
        envelope.from = (line.match(/<([^>]*)>/) || [])[1] || '';
        sock.write('250 2.1.0 Ok\r\n');
      } else if (cmd === 'RCPT') {
        envelope.to = (line.match(/<([^>]*)>/) || [])[1] || '';
        sock.write('250 2.1.5 Ok\r\n');
      } else if (cmd === 'DATA') {
        inData = true;
        sock.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (cmd === 'QUIT') {
        sock.write('221 2.0.0 Bye\r\n');
        sock.end();
      } else {
        sock.write('250 OK\r\n');
      }
    };

    function finishPlain(arg) {
      const dec = Buffer.from(arg, 'base64').toString('utf8');
      const parts = dec.split('\0');
      const u = parts[parts.length - 2] || '';
      const p = parts[parts.length - 1] || '';
      const ok = u === USER && p === PASS;
      sock.write(ok ? '235 2.7.0 Authentication successful\r\n' : '535 5.7.8 Authentication failed\r\n');
      authStep = null;
    }

    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end >= 0) {
          received.push({ ...envelope, body: buf.slice(0, end) });
          buf = buf.slice(end + 5);
          inData = false;
          sock.write('250 2.0.0 OK queued as STUB001\r\n');
        }
        return;
      }
      let nl;
      while ((nl = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        handle(line);
      }
    });

    sock.on('error', () => {});
  });

  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

module.exports = { start, received, PORT, USER, PASS };
