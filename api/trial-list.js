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

  // AUTO-DETECT: Find any environment variable that looks like a Vercel KV setup
  const findKVVar = (suffix) => {
    if (process.env[suffix]) return process.env[suffix];
    const key = Object.keys(process.env).find(k => k.endsWith(suffix));
    return key ? process.env[key] : null;
  };

  const KV_URL = findKVVar('KV_REST_API_URL');
  const KV_TOKEN = findKVVar('KV_REST_API_TOKEN');

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ message: 'KV Database not configured' });
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
