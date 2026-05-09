export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { deviceId, storeName } = req.body;
  
  // ULTIMATE DETECT: Try all possible Vercel KV / Upstash naming patterns
  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || Object.keys(process.env).find(k => k.includes('REST_API_URL'));
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || Object.keys(process.env).find(k => k.includes('REST_API_TOKEN'));
    return { url: process.env[url] || url, token: process.env[token] || token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ message: 'KV Database not configured' });
  }

  if (!deviceId) {
    return res.status(400).json({ message: 'Device ID required' });
  }

  try {
    const now = Date.now().toString();
    
    // Check if it already exists first (safety)
    const checkRes = await fetch(`${KV_URL}/get/trial:${deviceId}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const checkData = await checkRes.json();
    
    if (checkData.result) {
      return res.status(200).json({ status: 'existing', startTime: checkData.result });
    }

    // Set the record: key=trial:DEVICE_ID, value=TIMESTAMP
    // Also store a secondary index for the admin panel to view logs
    // SET trial:ID TIMESTAMP
    await fetch(`${KV_URL}/set/trial:${deviceId}/${now}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });

    // Add to a list of 'recent_trials' for the admin dashboard
    const logEntry = JSON.stringify({ deviceId, storeName, date: now });
    await fetch(`${KV_URL}/lpush/recent_trials/${encodeURIComponent(logEntry)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });

    return res.status(200).json({ status: 'new', startTime: now });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}
