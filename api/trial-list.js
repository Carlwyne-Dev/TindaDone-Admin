export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { password } = req.query;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xyuuki18';

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return { url, token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
  
  if (!KV_URL || !KV_TOKEN) {
    return res.status(200).json({ logs: [] });
  }

  try {
    const response = await fetch(`${KV_URL}/lrange/recent_trials/0/50`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await response.json();

    const logs = (data.result || []).map(entry => {
      try {
        return typeof entry === 'string' ? JSON.parse(entry) : entry;
      } catch (e) {
        return { deviceId: 'Unknown', storeName: 'Parse Error', date: Date.now() };
      }
    });

    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
