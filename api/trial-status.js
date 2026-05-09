export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { deviceId } = req.query;
  
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

  if (!deviceId) {
    return res.status(400).json({ message: 'Device ID required' });
  }

  try {
    // Check if ID exists in KV
    const response = await fetch(`${KV_URL}/get/trial:${deviceId}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await response.json();

    if (data.result) {
      return res.status(200).json({ exists: true, startTime: data.result });
    } else {
      return res.status(200).json({ exists: false });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}
