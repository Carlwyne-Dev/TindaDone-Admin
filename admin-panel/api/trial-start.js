export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const getKVEnv = () => {
    // 🔍 AGGRESSIVE SCAN: Look for anything resembling Vercel KV / Upstash
    let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      // Look for custom prefixes (e.g., MY_DB_REST_API_URL)
      const keys = Object.keys(process.env);
      const urlKey = keys.find(k => k.endsWith('_REST_API_URL'));
      const tokenKey = keys.find(k => k.endsWith('_REST_API_TOKEN'));
      if (urlKey) url = process.env[urlKey];
      if (tokenKey) token = process.env[tokenKey];
    }
    
    return { url, token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();

  // Diagnostic Mode
  if (req.query.diag === 'true') {
    return res.status(200).json({
      db_found: KV_URL ? 'YES (Aggressive Scan Found It!)' : 'NO',
      token_found: KV_TOKEN ? 'YES' : 'NO',
      env_keys_count: Object.keys(process.env).length,
      v: '1.4'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { deviceId, storeName } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  if (!KV_URL || !KV_TOKEN) {
    return res.status(200).json({ status: 'offline-mode', startTime: Date.now().toString(), v: '1.4' });
  }

  try {
    const nowTimestamp = Date.now().toString();

    // 1. Check if trial already exists
    const checkRes = await fetch(`${KV_URL}/get/trial:${deviceId}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const checkData = await checkRes.json();
    
    if (checkData.result) {
      return res.status(200).json({ status: 'existing', startTime: checkData.result, v: '1.4' });
    }

    // 2. Save trial start time
    await fetch(`${KV_URL}/set/trial:${deviceId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(nowTimestamp)
    });

    // 3. Add to 'recent_trials' list for Admin Dashboard
    const logEntry = { deviceId, storeName: storeName || 'Unknown Store', date: Date.now() };
    
    await fetch(`${KV_URL}/lpush/recent_trials`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    });

    await fetch(`${KV_URL}/ltrim/recent_trials/0/99`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });

    return res.status(200).json({ status: 'success', startTime: nowTimestamp, v: '1.4' });
  } catch (error) {
    return res.status(200).json({ status: 'fallback', startTime: Date.now().toString(), v: '1.4' });
  }
}
