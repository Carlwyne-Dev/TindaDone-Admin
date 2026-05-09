import crypto from 'crypto';

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { deviceCode, password } = req.body;

  // Verify Admin Password securely on the server
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xyuuki18';
  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'tindadone_admin_2026_xyz';

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Unauthorized. Invalid Admin Password.' });
  }

  if (!deviceCode) {
    return res.status(400).json({ message: 'Device code is required.' });
  }

  try {
    // Generate the Hash strictly on the server backend
    const dataToHash = deviceCode + ADMIN_SECRET;
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    // Format the key
    const clean = hash.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const key = `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;

    return res.status(200).json({ key });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
