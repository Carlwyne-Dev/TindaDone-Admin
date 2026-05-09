// 🔍 SHARED AGGRESSIVE SCANNER
const getKVEnv = () => {
  let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    const keys = Object.keys(process.env);
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

  const { licenseKey, deviceId } = req.body;
  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  
  if (!KV_URL || !KV_TOKEN) return res.status(200).json({ success: true });

  try {
    const response = await fetch(`${KV_URL}/get/td_key_history`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await response.json();
    let history = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : [];

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
  } catch (error) { return res.status(500).json({ message: 'Error' }); }
}
