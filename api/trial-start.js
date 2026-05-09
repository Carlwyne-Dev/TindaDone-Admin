export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { deviceId, storeName } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'Missing deviceId' });

  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return { url, token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  
  if (!KV_URL || !KV_TOKEN) {
    return res.status(200).json({ status: 'offline-mode', startTime: Date.now().toString() });
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

    return res.status(200).json({ status: 'success', startTime: nowTimestamp });
  } catch (error) {
    return res.status(200).json({ status: 'fallback', startTime: Date.now().toString() });
  }
}
