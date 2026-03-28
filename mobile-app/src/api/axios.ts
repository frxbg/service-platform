import axios from 'axios';

const fallbackApiBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl;

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mobile_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('mobile_refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('mobile_access_token');
        localStorage.removeItem('mobile_refresh_token');
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        localStorage.setItem('mobile_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('mobile_refresh_token', data.refresh_token);
        }
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('mobile_access_token');
        localStorage.removeItem('mobile_refresh_token');
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
