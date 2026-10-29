// Servidor sin dependencias. Guarda la API key en el servidor y descarga los archivos para ti.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const KEY = process.env.CURSEFORGE_API_KEY;
const PORT = process.env.PORT || 3000;
const API = 'https://api.curseforge.com/v1';
const PAGE = 20;
const SORT = { popular: 2, recent: 3, downloads: 6 };
const cache = new Map();
let gameId = process.env.GAME_ID ? Number(process.env.GAME_ID) : null;

async function cf(p) {
  const hit = cache.get(p);
  if (hit && Date.now() - hit.t < 300000) return hit.v;
  const r = await fetch(API + p, { headers: { 'x-api-key': KEY, Accept: 'application/json' } });
  if (!r.ok) throw new Error('CurseForge respondió con error ' + r.status);
  const v = await r.json();
  cache.set(p, { t: Date.now(), v });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return v;
}

async function getGameId() {
  if (gameId) return gameId;
  for (let i = 0; i < 4; i++) {
    const { data } = await cf(`/games?pageSize=50&index=${i * 50}`);
    const g = data.find(x => /bedrock/i.test(x.name) || /bedrock/i.test(x.slug));
    if (g) return (gameId = g.id);
    if (data.length < 50) break;
  }
  throw new Error('No encontré Minecraft Bedrock con tu API key. Define GAME_ID a mano.');
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

async function search(url, res) {
  const q = url.searchParams.get('q') || '';
  const sort = SORT[url.searchParams.get('sort')] || 2;
  const page = Math.max(0, parseInt(url.searchParams.get('page')) || 0);
  const gid = await getGameId();
  const qs = new URLSearchParams({
    gameId: gid, searchFilter: q, sortField: sort, sortOrder: 'desc',
    pageSize: PAGE, index: page * PAGE,
  });
  const { data } = await cf('/mods/search?' + qs);
  const mods = data.map(m => {
    const f = [...(m.latestFiles || [])].sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate))[0];
    return {
      id: m.id, name: m.name, summary: m.summary,
      icon: m.logo && m.logo.thumbnailUrl,
      downloads: m.downloadCount,
      author: m.authors && m.authors[0] && m.authors[0].name,
      fileId: f && f.id,
      direct: !!(f && f.downloadUrl && m.allowModDistribution !== false),
    };
  });
  json(res, 200, { mods, more: mods.length === PAGE });
}

async function download(url, res) {
  const mod = url.searchParams.get('mod');
  const file = url.searchParams.get('file');
  if (!/^\d+$/.test(mod || '') || !/^\d+$/.test(file || '')) return json(res, 400, { error: 'Datos inválidos' });
  const { data: f } = await cf(`/mods/${mod}/files/${file}`);
  let host = '';
  try { host = new URL(f.downloadUrl).hostname; } catch (e) {}
  if (!/(^|\.)(forgecdn\.net|curseforge\.com)$/.test(host)) {
    // El autor no permite descargas fuera de CurseForge: llevamos a su página oficial.
    const { data: m } = await cf('/mods/' + mod);
    res.writeHead(302, { Location: (m.links && m.links.websiteUrl) || 'https://www.curseforge.com/minecraft-bedrock' });
    return res.end();
  }
  const r = await fetch(f.downloadUrl, { redirect: 'follow' });
  if (!r.ok) throw new Error('No se pudo bajar el archivo (' + r.status + ')');
  const name = String(f.fileName || 'addon.mcaddon').replace(/[^\w.\- ()]/g, '_');
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${name}"`,
  });
  Readable.fromWeb(r.body).pipe(res);
}

const MANIFEST = {
  name: 'Bedrock Mods', short_name: 'Mods', start_url: '/', display: 'standalone',
  background_color: '#15121f', theme_color: '#15121f',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    }
    if (url.pathname === '/manifest.json') return json(res, 200, MANIFEST);
    if (!KEY) return json(res, 500, { error: 'Falta la variable CURSEFORGE_API_KEY en el servidor.' });
    if (url.pathname === '/api/search') return await search(url, res);
    if (url.pathname === '/api/download') return await download(url, res);
    json(res, 404, { error: 'No existe' });
  } catch (e) {
    if (!res.headersSent) json(res, 502, { error: e.message });
    else res.end();
  }
}).listen(PORT, () => console.log('Listo en el puerto ' + PORT));
if (url.pathname === '/icon-192.png' || url.pathname === '/icon-512.png') {
  const file = path.join(__dirname, path.basename(url.pathname));

  if (!fs.existsSync(file)) {
    return json(res, 404, { error: 'Icono no encontrado en el servidor' });
  }

  res.writeHead(200, { 'Content-Type': 'image/png' });
  return fs.createReadStream(file).pipe(res);
}
