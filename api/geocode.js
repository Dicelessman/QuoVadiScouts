// Serverless function per geocoding tramite Nominatim
// Evita problemi CORS chiamando il servizio dal server

module.exports = async function handler(req, res) {
  // Gestisci solo richieste GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  try {
    // Chiama Nominatim direttamente dal server (no CORS)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=it&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'QuoVadiScout/1.0 (https://quovadiscout.vercel.app)'
      }
    });

    if (!response.ok) {
      res.status(response.status).json({ 
        error: `Nominatim API error: ${response.status}` 
      });
      return;
    }

    const data = await response.json();

    // Restituisci i risultati con CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
