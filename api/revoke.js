export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_PASSWORD } = process.env;
  
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(500).json({ message: 'KV Database not configured' });
  }

  const { password, deviceCode, action } = req.body;

  if (password !== (ADMIN_PASSWORD || 'xyuuki18')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!deviceCode || !['revoke', 'restore'].includes(action)) {
    return res.status(400).json({ message: 'Missing deviceCode or invalid action' });
  }

  try {
    // We use a Redis SET (SADD / SREM) to store revoked device codes for O(1) lookups
    const kvAction = action === 'revoke' ? 'sadd' : 'srem';
    
    await fetch(`${KV_REST_API_URL}/${kvAction}/td_revoked_keys/${deviceCode}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });

    // Also update the history object status so the UI knows
    let history = [];
    const getRes = await fetch(`${KV_REST_API_URL}/get/td_key_history`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    const data = await getRes.json();
    if (data.result) history = JSON.parse(data.result);

    let updated = false;
    history = history.map(h => {
      if (h.code === deviceCode) {
        updated = true;
        return { ...h, revoked: action === 'revoke' };
      }
      return h;
    });

    if (updated) {
      await fetch(`${KV_REST_API_URL}/set/td_key_history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(history))
      });
    }

    return res.status(200).json({ success: true, action, deviceCode });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to update revocation status', error: e.toString() });
  }
}
