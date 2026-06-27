import { mockApiRequest } from './mockApi.js';

const API_URL = process.env.VUE_APP_API_URL;

// When VUE_APP_OFFLINE is set, requests are served by the in-memory mock
// backend (mockApi.js) so the client runs with no server. See the
// `serve:offline` npm script / .env.offline.
export const IS_OFFLINE = process.env.VUE_APP_OFFLINE === 'true';

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
