'use strict';

// Vercel Serverless Function —— 健康检查端点 GET /api/health
// 通过 vercel.json 的 rewrite，对外也暴露为 GET /health
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  res.status(200).json({ ok: true, time: Date.now() });
};
