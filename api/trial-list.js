export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify Admin Password (simple security)
  const { password } = req.query;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xyuuki18';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // ULTIMATE DETECT: Try all possible Vercel KV / Upstash naming patterns
  const getKVEnv = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || Object.keys(process.env).find(k => k.includes('REST_API_URL'));
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || Object.keys(process.env).find(k => k.includes('REST_API_TOKEN'));
    return { url: process.env[url] || url, token: process.env[token] || token };
  };

  const { url: KV_URL, token: KV_TOKEN } = getKVEnv();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ 
      message: 'KV Database not configured', 
      debug: { hasKeys: Object.keys(process.env).filter(k => k.includes('KV') || k.includes('REDIS')) } 
    });
  }

  try {
    // Fetch last 50 trial logs from Redis list
    const response = await fetch(`${KV_URL}/lrange/recent_trials/0/50`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await response.json();
    
    // Parse the JSON strings in the list
    const logs = (data.result || []).map(entry => {
      try {
        return JSON.parse(entry);
      } catch (e) {
        return { error: 'Invalid log format', raw: entry };
      }
    });

    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}
