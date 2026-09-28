'use strict';

// Vercel Serverless Function —— 端到端加密同步的「哑存储」后端
//
// 设计原则（与 sync-server.js 完全一致，隐私优先）：
// - 只存储密文（salt / iv / data）与时间戳，永远看不到明文，也无法解密。
// - 解密密钥由客户端密码经 PBKDF2 派生，密码从不上传。
// - 本函数对内容不可知、不可解密，仅做「按 syncId 存/取密文」。
//
// 存储后端：Vercel KV（键值库）。key = syncId，value = {salt,iv,data,updatedAt}。
// 通过 vercel.json 的 rewrite，对外暴露为 GET/PUT /sync/:id（与前端 sync.js 调用路径一致）。

const { kv } = require('@vercel/kv');

// 与 sync-server.js 保持一致的 ID 约束，杜绝路径穿越与注入
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const id = req.query && req.query.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  // 拉取
  if (req.method === 'GET') {
    let obj;
    try {
      obj = await kv.get(id);
    } catch (e) {
      res.status(500).json({ error: 'kv error: ' + e.message });
      return;
    }
    if (obj === null || obj === undefined) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(200).json(obj);
    return;
  }

  // 上传（覆盖写，last-write-wins；冲突由客户端提示用户处理）
  if (req.method === 'PUT') {
    let body = '';
    try {
      for await (const chunk of req) body += chunk;
    } catch (e) {
      res.status(400).json({ error: 'read body failed' });
      return;
    }
    let obj;
    try {
      obj = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ error: 'bad json' });
      return;
    }
    if (typeof obj.salt !== 'string' || typeof obj.iv !== 'string' || typeof obj.data !== 'string') {
      res.status(400).json({ error: 'missing fields' });
      return;
    }
    const record = { salt: obj.salt, iv: obj.iv, data: obj.data, updatedAt: Date.now() };
    try {
      await kv.set(id, record);
    } catch (e) {
      res.status(500).json({ error: 'kv error: ' + e.message });
      return;
    }
    res.status(200).json({ ok: true, updatedAt: record.updatedAt });
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
};
