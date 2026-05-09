export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    // If KV isn't setup, we just say everything is fine to not break offline apps
    return res.status(200).json({ revoked: false });
  }

  const { deviceId } = req.query;

  if (!deviceId) {
    return res.status(400).json({ message: 'Missing deviceId' });
  }

  try {
    // Check if the deviceId is in the revoked set (SISMEMBER returns 1 if true)
    const response = await fetch(`${KV_URL}/sismember/td_revoked_keys/${deviceId}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    
    const data = await response.json();
    const isRevoked = data.result === 1;

    return res.status(200).json({ revoked: isRevoked });
  } catch (e) {
    // Fail silently to not lock out users if Vercel is down
    return res.status(200).json({ revoked: false });
  }
}
