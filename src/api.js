// api.js

const API_URL = 'http://localhost:8081'; // Change to your API URL

// Helper function for making HTTP requests
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