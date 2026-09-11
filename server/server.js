const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const databasePath = process.env.DATA_FILE_PATH || path.join(__dirname, 'database.json');
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

function readDatabase() {
  try { return JSON.parse(fs.readFileSync(databasePath, 'utf8')); }
  catch { return {}; }
}

function writeDatabase(database) {
  const temporaryPath = `${databasePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(database, null, 2));
  fs.renameSync(temporaryPath, databasePath);
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function serveFile(requestPath, response) {
  const requested = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method === 'GET' && request.url === '/api/database') {
    sendJson(response, 200, readDatabase());
    return;
  }
  if (request.method === 'PUT' && request.url === '/api/database') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try {
        const database = JSON.parse(body);
        if (!database || typeof database !== 'object' || Array.isArray(database)) throw new Error('Invalid database');
        writeDatabase(database);
        sendJson(response, 200, { saved: true });
      } catch (error) {
        sendJson(response, 400, { saved: false, error: error.message });
      }
    });
    return;
  }
  if (request.method === 'GET') serveFile(request.url.split('?')[0], response);
  else sendJson(response, 405, { error: 'Method not allowed' });
});

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => console.log(`Saachi Crochet Corner running on port ${port}`));