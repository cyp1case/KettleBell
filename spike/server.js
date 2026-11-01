// Throwaway server for the YouTube playback spike. No dependencies.
// node spike/server.js          -> http://127.0.0.1:8137 (this computer only)
// node spike/server.js --lan    -> also reachable from the TV on the home network
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8137;
const LAN = process.argv.includes('--lan');
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, 'logs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

const CONFIG = path.join(LOG_DIR, 'config.json');

fs.mkdirSync(LOG_DIR, { recursive: true });

http.createServer((req, res) => {
  // The computer saves the clip list here so the TV can load it without typing.
  if (req.url === '/config') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.existsSync(CONFIG) ? fs.readFileSync(CONFIG) : '{}');
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        try { JSON.parse(body); fs.writeFileSync(CONFIG, body); res.writeHead(200).end('ok'); }
        catch { res.writeHead(400).end('bad json'); }
      });
      return;
    }
  }
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const run = JSON.parse(body);
        const ua = req.headers['user-agent'] || '';
        const name = `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        fs.writeFileSync(path.join(LOG_DIR, name), JSON.stringify({ ua, from: req.socket.remoteAddress, ...run }, null, 2));
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end(name);
      } catch {
        res.writeHead(400).end('bad json');
      }
    });
    return;
  }
  const url = req.url.split('?')[0];
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || file.startsWith(LOG_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`spike on http://127.0.0.1:${PORT}`);
  if (LAN) {
    for (const addrs of Object.values(os.networkInterfaces()))
      for (const a of addrs || [])
        if (a.family === 'IPv4' && !a.internal) console.log(`TV url:  http://${a.address}:${PORT}`);
  }
});
