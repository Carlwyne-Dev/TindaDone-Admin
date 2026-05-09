export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ULTIMATE DETECT: Try all possible Vercel KV / Upstash naming patterns
  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || Object.keys(process.env).find(k => k.includes('REST_API_URL'));
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || Object.keys(process.env).find(k => k.includes('REST_API_TOKEN'));
    return { url: process.env[url] || url, token: process.env[token] || token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xyuuki18';
  
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ 
      message: 'KV Database not configured', 
      debug: { hasKeys: Object.keys(process.env).filter(k => k.includes('KV') || k.includes('REDIS')) } 
    });
  }

  // GET: Fetch History
  if (req.method === 'GET') {
    try {
      const response = await fetch(`${KV_URL}/get/td_key_history`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const data = await response.json();
      return res.status(200).json({ history: data.result ? JSON.parse(data.result) : [] });
    } catch (e) {
      return res.status(500).json({ message: 'Failed to fetch history', error: e.toString() });
    }
  }

  // POST: Add to History
  if (req.method === 'POST') {
    const { password, entry } = req.body;
    if (password !== (ADMIN_PASSWORD || 'xyuuki18')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const getRes = await fetch(`${KV_URL}/get/td_key_history`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const data = await getRes.json();
      if (data.result) history = JSON.parse(data.result);

      // 2. Add new entry / filter
      if (req.method === 'POST') {
        history.unshift(entry);
        history = history.slice(0, 200);
      } else {
        history = history.filter(h => h.ts !== ts);
      }

      await fetch(`${KV_URL}/set/td_key_history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(history))
      });

      return res.status(200).json({ success: true, history });
    } catch (e) {
      return res.status(500).json({ message: 'Failed to save history' });
    }
  }

  // DELETE: Remove from History
  if (req.method === 'DELETE') {
    const { password, ts } = req.body;
    if (password !== (ADMIN_PASSWORD || 'xyuuki18')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      let history = [];
      const getRes = await fetch(`${KV_REST_API_URL}/get/td_key_history`, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });
      const data = await getRes.json();
      if (data.result) history = JSON.parse(data.result);

      history = history.filter(h => h.ts !== ts);

      await fetch(`${KV_REST_API_URL}/set/td_key_history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(history))
      });

      return res.status(200).json({ success: true, history });
    } catch (e) {
      return res.status(500).json({ message: 'Failed to delete history' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
