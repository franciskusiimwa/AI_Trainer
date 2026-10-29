const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const publicDirectory = path.join(__dirname, 'public');
const progressFile = process.env.PROGRESS_FILE || path.join(__dirname, 'data', 'progress.json');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};
let writeQueue = Promise.resolve();

async function readProgress() {
  try {
    const progress = JSON.parse(await fs.readFile(progressFile, 'utf8'));
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
      throw new Error('Saved progress must be a JSON object.');
    }
    return progress;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function updateProgress(key, value) {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const progress = await readProgress();
    progress[key] = value;
    await fs.mkdir(path.dirname(progressFile), { recursive: true });
    const temporaryFile = `${progressFile}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(progress, null, 2));
    await fs.rename(temporaryFile, progressFile);
    return progress;
  });
  return writeQueue;
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': contentTypes['.json'] });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

async function serveStatic(request, response, pathname) {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    sendJson(response, 400, { error: 'Invalid URL path.' });
    return;
  }

  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      'content-type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'content-length': file.length,
      'x-content-type-options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch (error) {
    sendJson(response, error.code === 'ENOENT' ? 404 : 500, { error: 'File not found.' });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/api/progress' && request.method === 'GET') {
    try {
      sendJson(response, 200, { progress: await readProgress() });
    } catch {
      sendJson(response, 500, { error: 'Could not load saved progress.' });
    }
    return;
  }

  if (url.pathname === '/api/progress' && request.method === 'PUT') {
    try {
      const body = await readJsonBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'key') || !Object.hasOwn(body, 'value')) {
        sendJson(response, 400, { error: 'Request must include a key and value.' });
        return;
      }
      const { key, value } = body;
      if (typeof key !== 'string' || !/^(quiz|plan|build|r-[a-z0-9-]+)$/.test(key)) {
        sendJson(response, 400, { error: 'Unsupported progress key.' });
        return;
      }
      sendJson(response, 200, { progress: await updateProgress(key, value) });
    } catch (error) {
      sendJson(response, error.status || 500, { error: error.status ? error.message : 'Could not save progress.' });
    }
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API route not found.' });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }
  await serveStatic(request, response, url.pathname);
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => {
  console.log(`AI Trainer listening at http://${host}:${port}`);
});