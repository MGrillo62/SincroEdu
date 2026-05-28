/**
 * Centralized API configurations for SincroEdu
 */

export const getBaseUrl = (): string => {
  // Check if NEXT_PUBLIC_API_URL is configured (e.g. from Vercel env variables)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, ''); // Remove trailing slash if present
  }
  return 'http://localhost:4000';
};

export const getApiUrl = (): string => {
  return `${getBaseUrl()}/api`;
};
