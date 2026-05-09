// 🔍 PRECISION AGGRESSIVE SCANNER (v4.0)
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xyuuki18';

  if (req.method === 'GET') {
    const { password } = req.query;
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Unauthorized' });
    if (!KV_URL || !KV_TOKEN) return res.status(200).json({ history: [] });

    try {
      const response = await fetch(`${KV_URL}/get/td_key_history`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const data = await response.json();
      return res.status(200).json({ history: data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : [] });
    } catch (e) { return res.status(500).json({ message: 'Error' }); }
  }

  if (req.method === 'POST' || req.method === 'DELETE') {
    const { password, entry, ts } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Unauthorized' });
    if (!KV_URL || !KV_TOKEN) return res.status(500).json({ message: 'DB not linked' });

    try {
      const getRes = await fetch(`${KV_URL}/get/td_key_history`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const getData = await getRes.json();
      let history = getData.result ? (typeof getData.result === 'string' ? JSON.parse(getData.result) : getData.result) : [];

      if (req.method === 'POST') history.unshift(entry);
      else if (ts) history = history.filter(h => h.ts !== ts);

      await fetch(`${KV_URL}/set/td_key_history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(history)
      });
      return res.status(200).json({ success: true, history });
    } catch (e) { return res.status(500).json({ message: 'Update failed' }); }
  }
}
