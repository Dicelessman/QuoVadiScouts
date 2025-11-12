import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  // Supporta solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const manifestPath = join(process.cwd(), 'manifest.json');
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    // Imposta headers corretti per manifest.json
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Restituisci il manifest
    res.status(200).json(manifest);
  } catch (error) {
    console.error('Error loading manifest:', error);
    res.status(500).json({ error: 'Failed to load manifest' });
  }
}

