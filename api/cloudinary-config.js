export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  const body = `window.CloudinaryConfig = {
    cloudName: ${JSON.stringify(process.env.CLOUDINARY_CLOUD_NAME || '')},
    apiKey: ${JSON.stringify(process.env.CLOUDINARY_API_KEY || '')},
    uploadPreset: ${JSON.stringify(process.env.CLOUDINARY_UPLOAD_PRESET || '')},
    folder: ${JSON.stringify(process.env.CLOUDINARY_FOLDER || '')},
    secure: true
  };`;
  res.status(200).send(body);
}


