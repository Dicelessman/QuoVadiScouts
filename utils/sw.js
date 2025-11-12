export function isCacheableRequestLike({ url, method = 'GET', credentials = 'omit' }) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  } catch {
    return false;
  }
  if (method !== 'GET') return false;
  if (credentials === 'include') return false;
  return true;
}

