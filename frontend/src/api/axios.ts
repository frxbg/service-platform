import axios from 'axios';
import { redirectToLogin } from '../utils/authNavigation';

const fallbackApiBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl;

const api = axios.create({
    baseURL: apiBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, {
                        refresh_token: refreshToken,
                    });
                    localStorage.setItem('access_token', data.access_token);
                    if (data.refresh_token) {
                        localStorage.setItem('refresh_token', data.refresh_token);
                    }
                    api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Logout if refresh fails
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    redirectToLogin('unauthorized');
                }
            } else {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                redirectToLogin('unauthorized');
            }
        }
        return Promise.reject(error);
    }
);

export default api;
