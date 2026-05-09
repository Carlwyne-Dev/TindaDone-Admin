export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // BETTER DETECT: Explicitly look for the HTTPS REST URL
  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return { url, token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xyuuki18';
  
  if (!KV_URL || !KV_TOKEN) {
    if (req.method === 'GET') return res.status(200).json({ history: [] });
    return res.status(200).json({ success: false, message: 'DB not linked' });
  }

  // GET: Fetch History
  if (req.method === 'GET') {
    try {
      const response = await fetch(`${KV_URL}/get/td_key_history`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const data = await response.json();
      let history = [];
      if (data.result) {
        try {
          history = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        } catch (e) {
          history = [];
        }
      }
      return res.status(200).json({ history });
    } catch (e) {
      return res.status(500).json({ message: 'Failed to fetch history' });
    }
  }

  // POST/DELETE: Modify History
  if (req.method === 'POST' || req.method === 'DELETE') {
    const { password, entry, ts } = req.body;
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // 1. Get current
      const getRes = await fetch(`${KV_URL}/get/td_key_history`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const getData = await getRes.json();
      let history = [];
      if (getData.result) {
        try {
          history = typeof getData.result === 'string' ? JSON.parse(getData.result) : getData.result;
        } catch (e) {
          history = [];
        }
      }

      // 2. Update
      if (req.method === 'POST') {
        history.unshift(entry);
        history = history.slice(0, 500); // Keep last 500
      } else if (ts) {
        history = history.filter(h => h.ts !== ts);
      }

      // 3. Save (Standard POST with body)
      await fetch(`${KV_URL}/set/td_key_history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(history))
      });

      return res.status(200).json({ success: true, history });
    } catch (e) {
      return res.status(500).json({ message: 'Failed to update history' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
