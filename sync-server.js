/**
 * sync-server.js —— 端到端加密云同步的「哑存储」后端
 *
 * 设计原则（隐私优先）：
 * - 服务器只存储密文（salt / iv / data）与时间戳，永远看不到明文健康数据。
 * - 解密密钥由客户端密码经 PBKDF2 派生，密码从不上传。
 * - 本服务对内容不可知、不可解密，仅做「按 syncId 存/取密文」。
 *
 * 运行： node sync-server.js            （默认端口 8080）
 *        PORT=9000 node sync-server.js
 * 依赖： 仅 Node.js 内置模块，无需 npm install。
 *
 * API：
 *   GET  /health                -> {ok:true}
 *   GET  /sync/:id              -> 404 或 {salt,iv,data,updatedAt}
 *   PUT  /sync/:id  body JSON    -> {ok:true, updatedAt}（写入并刷新 updatedAt）
 *   OPTIONS /sync/:id           -> CORS 预检
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.SYNC_DATA_DIR || path.join(__dirname, 'sync-data');
const MAX_BODY = 8 * 1024 * 1024; // 8MB 上限，足够容纳压缩后的健康库

// 严格约束 syncId，杜绝路径穿越与注入
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function mkdirp(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}
mkdirp(DATA_DIR);

function idToFile(id) {
  // id 已校验为安全字符，拼路径前再确认一次
  if (!ID_RE.test(id)) return null;
  return path.join(DATA_DIR, id + '.json');
}

function sendJson(res, code, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  }, extraHeaders || {}));
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const m = /^\/sync\/([^/]+)$/.exec(url);

  // CORS 预检
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {}, {});
    return;
  }

  // 健康检查
  if (url === '/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, time: Date.now() });
    return;
  }

  // 同步接口
  if (m) {
    const id = decodeURIComponent(m[1]);
    const file = idToFile(id);
    if (!file) { sendJson(res, 400, { error: 'invalid id' }); return; }

    // 拉取
    if (req.method === 'GET') {
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) { sendJson(res, 404, { error: 'not found' }); return; }
        try {
          const obj = JSON.parse(data);
          sendJson(res, 200, obj);
        } catch (e) { sendJson(res, 500, { error: 'corrupt record' }); }
      });
      return;
    }

    // 上传（覆盖写，last-write-wins；冲突由客户端提示用户处理）
    if (req.method === 'PUT') {
      let raw;
      try { raw = await readBody(req); } catch (e) { sendJson(res, 413, { error: e.message }); return; }
      let obj;
      try { obj = JSON.parse(raw); } catch (e) { sendJson(res, 400, { error: 'bad json' }); return; }
      if (typeof obj.salt !== 'string' || typeof obj.iv !== 'string' || typeof obj.data !== 'string') {
        sendJson(res, 400, { error: 'missing fields' });
        return;
      }
      const record = {
        salt: obj.salt,
        iv: obj.iv,
        data: obj.data,
        updatedAt: Date.now(),
      };
      fs.writeFile(file, JSON.stringify(record), 'utf8', err => {
        if (err) { sendJson(res, 500, { error: 'write failed' }); return; }
        sendJson(res, 200, { ok: true, updatedAt: record.updatedAt });
      });
      return;
    }

    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log('[sync-server] listening on http://0.0.0.0:' + PORT);
  console.log('[sync-server] data dir: ' + DATA_DIR);
});
