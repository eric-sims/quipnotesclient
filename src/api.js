import { mockApiRequest } from './mockApi.js';

const API_URL = import.meta.env.VITE_API_URL;

// When VITE_OFFLINE is set, requests are served by the in-memory mock
// backend (mockApi.js) so the client runs with no server. See the
// `dev:offline` npm script / .env.offline.
export const IS_OFFLINE = import.meta.env.VITE_OFFLINE === 'true';

export async function apiRequest(method, url, body = null, headers = {}) {
  if (IS_OFFLINE) {
    return mockApiRequest(method, url, body);
  }

  const options = {
    method: method,
    headers: headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return await fetch(`${API_URL}${url}`, options);
}
