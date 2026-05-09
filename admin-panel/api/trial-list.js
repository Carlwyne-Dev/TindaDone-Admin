// 🩺 BLACK BOX RECORDER (v5.0)
const getKVEnv = () => {
  try {
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
  } catch (e) { return { url: null, token: null }; }
};

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { password } = req.query;
    const adminPass = process.env.ADMIN_PASSWORD || 'xyuuki18';
    if (password !== adminPass) return res.status(401).json({ error: 'Auth Failed' });

    const { url: KV_URL, token: KV_TOKEN } = getKVEnv();
    if (!KV_URL || !KV_TOKEN) return res.status(200).json({ logs: [], info: 'DB Not Linked' });

    const response = await fetch(`${KV_URL}/lrange/recent_trials/0/50`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    
    const data = await response.json();
    return res.status(200).json({ logs: data.result || [] });

  } catch (error) {
    // 🕵️ Report the actual crash reason
    return res.status(200).json({ 
      error: true, 
      message: 'CRASH PREVENTED', 
      details: error.message,
      stack: error.stack?.substring(0, 50)
    });
  }
}
