export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  const body = `window.FirebaseConfig = {
    apiKey: ${JSON.stringify(process.env.FIREBASE_API_KEY || '')},
    authDomain: ${JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN || '')},
    projectId: ${JSON.stringify(process.env.FIREBASE_PROJECT_ID || '')},
    storageBucket: ${JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET || '')},
    messagingSenderId: ${JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID || '')},
    appId: ${JSON.stringify(process.env.FIREBASE_APP_ID || '')},
    measurementId: ${JSON.stringify(process.env.FIREBASE_MEASUREMENT_ID || '')},
    vapidKey: ${JSON.stringify(process.env.FIREBASE_VAPID_KEY || '')},
    environment: 'production'
  };`;
  res.status(200).send(body);
}


