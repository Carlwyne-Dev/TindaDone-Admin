export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { licenseKey, deviceId } = req.body;
  if (!licenseKey || !deviceId) return res.status(400).json({ message: 'Missing info' });

  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return { url, token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  
  if (!KV_URL || !KV_TOKEN) return res.status(200).json({ success: true });

  try {
    const response = await fetch(`${KV_URL}/get/td_key_history`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await response.json();
    let history = [];
    if (data.result) {
      history = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    }

    let found = false;
    history = history.map(h => {
      if (h.key === licenseKey || h.code === licenseKey) {
        found = true;
        return { ...h, activated: true, activatedDeviceId: deviceId, activatedAt: new Date().toLocaleString() };
      }
      return h;
    });

    if (found) {
      await fetch(`${KV_URL}/set/td_key_history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(history)
      });
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ message: 'Key not found' });
  } catch (error) {
    return res.status(500).json({ message: 'Error' });
  }
}
