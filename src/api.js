const API_URL = process.env.VUE_APP_API_URL;

export async function apiRequest(method, url, body = null, headers = {}) {
  const options = {
    method: method,
    headers: headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return await fetch(`${API_URL}${url}`, options);
}