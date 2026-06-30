// Typed route constants shared by the API (route definitions) and the web client.
// Extended as endpoints are implemented.

export const API_PREFIX = '/api';

export const ApiRoutes = {
  health: `${API_PREFIX}/health`,
  auth: {
    register: `${API_PREFIX}/auth/register`,
    login: `${API_PREFIX}/auth/login`,
    refresh: `${API_PREFIX}/auth/refresh`,
    logout: `${API_PREFIX}/auth/logout`,
    me: `${API_PREFIX}/auth/me`,
  },
  projects: `${API_PREFIX}/projects`,
} as const;
