export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { deviceId, revoke, password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xyuuki18';
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Unauthorized' });

  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return { url, token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ message: 'DB not linked' });

  try {
    if (revoke) {
      await fetch(`${KV_URL}/set/revoked:${deviceId}/true`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
    } else {
      await fetch(`${KV_URL}/del/revoked:${deviceId}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
    }

    // Also update history flag
    const hRes = await fetch(`${KV_URL}/get/td_key_history`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const hData = await hRes.json();
    if (hData.result) {
      let history = typeof hData.result === 'string' ? JSON.parse(hData.result) : hData.result;
      history = history.map(h => {
        if (h.code === deviceId) return { ...h, revoked: !!revoke };
        return h;
      });
      await fetch(`${KV_URL}/set/td_key_history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(history)
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Error' });
  }
}
