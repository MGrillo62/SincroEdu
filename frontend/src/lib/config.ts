/**
 * Centralized API configurations for SincroEdu
 */

export const getBaseUrl = (): string => {
  // Check if NEXT_PUBLIC_API_URL is configured (e.g. from Vercel env variables)
  if (process.env.NEXT_PUBLIC_API_URL) {
    let url = process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, '');
    // Safeguard: prepend https:// if protocol is missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url;
  }
  return 'http://localhost:4000';
};

export const getApiUrl = (): string => {
  return `${getBaseUrl()}/api`;
};
