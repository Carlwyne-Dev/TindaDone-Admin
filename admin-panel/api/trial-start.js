const https = require('https');

const kvRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const req = https.request(url, {
        method: options.method || 'GET',
        headers: {
          'Authorization': options.headers?.Authorization || '',
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve({ result: data }); }
        });
      });
      req.on('error', (e) => reject(e));
      req.on('timeout', () => reject(new Error('UPSTASH_TIMEOUT')));
      if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      req.end();
    } catch (err) { reject(err); }
  });
};

const getKVEnv = () => {
  let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const keys = Object.keys(process.env).sort();
    const uKey = keys.find(k => {
      const val = process.env[k];
      return (k.includes('REST_API_URL') || k.includes('REST_URL')) && val && val.startsWith('https://');
    });
    const tKey = keys.find(k => k.includes('REST_API_TOKEN') || k.includes('REST_TOKEN'));
    if (uKey) url = process.env[uKey];
    if (tKey) token = process.env[tKey];
  }
  return { url, token };
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();

  if (req.query.diag === 'true') {
    return res.status(200).json({
      db_found: KV_URL ? 'YES' : 'NO',
      v: '8.0-crash-reporter'
    });
  }

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { deviceId, storeName } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Missing deviceId' });
    if (!KV_URL || !KV_TOKEN) return res.status(200).json({ status: 'error', message: 'DB not linked' });

    const nowTimestamp = Date.now().toString();
    const checkData = await kvRequest(`${KV_URL}/get/trial:${deviceId}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    
    if (checkData.result) return res.status(200).json({ status: 'existing', startTime: checkData.result });

    await kvRequest(`${KV_URL}/set/trial:${deviceId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify(nowTimestamp)
    });

    await kvRequest(`${KV_URL}/lpush/recent_trials`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify({ deviceId, storeName: storeName || 'Unknown Store', date: Date.now() })
    });

    return res.status(200).json({ status: 'success', startTime: nowTimestamp });
  } catch (error) {
    // 🕵️ DETAILED CRASH REPORT
    return res.status(200).json({ 
      status: 'error', 
      error: true,
      message: 'NATIVE_CRASH',
      details: error.message,
      db_url_check: KV_URL ? KV_URL.substring(0, 10) : 'MISSING',
      stack: error.stack?.substring(0, 50)
    });
  }
};
