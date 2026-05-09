// 🔍 CONSISTENT AGGRESSIVE SCANNER
const getKVEnv = () => {
  let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    const keys = Object.keys(process.env).sort(); // Sort to ensure consistency!
    const uKey = keys.find(k => k.includes('REST_API_URL') || k.includes('REST_URL'));
    const tKey = keys.find(k => k.includes('REST_API_TOKEN') || k.includes('REST_TOKEN'));
    if (uKey) url = process.env[uKey];
    if (tKey) token = process.env[tKey];
  }
  return { url, token };
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();

  if (req.query.diag === 'true') {
    return res.status(200).json({
      db_found: KV_URL ? 'YES' : 'NO',
      db_url_masked: KV_URL ? KV_URL.substring(0, 15) + '...' : 'NONE',
      v: '3.0-consistent'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { deviceId, storeName } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  if (!KV_URL || !KV_TOKEN) {
    return res.status(200).json({ status: 'error', message: 'DB not found', v: '3.0' });
  }

  try {
    const nowTimestamp = Date.now().toString();

    // 1. Check if trial already exists
    const checkRes = await fetch(`${KV_URL}/get/trial:${deviceId}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const checkData = await checkRes.json();
    
    if (checkData.result) {
      return res.status(200).json({ status: 'existing', startTime: checkData.result });
    }

    // 2. Save trial start time
    await fetch(`${KV_URL}/set/trial:${deviceId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(nowTimestamp)
    });

    // 3. Add to 'recent_trials' list
    const logEntry = { deviceId, storeName: storeName || 'Unknown Store', date: Date.now() };
    
    await fetch(`${KV_URL}/lpush/recent_trials`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    });

    return res.status(200).json({ status: 'success', startTime: nowTimestamp });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
