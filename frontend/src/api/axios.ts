import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

interface RetryableAxiosRequestConfig
  extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: "http://localhost:8000", 
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = axios
    .post(
      "http://localhost:8000/users/refresh-token", 
      null,
      { withCredentials: true }
    )
    .then((response) => {
      const newAccessToken = response.data.access_token;

      if (!newAccessToken) {
        throw new Error("New access token was not returned");
      }

      const user = localStorage.getItem("user");

      if (user) {
        try {
          const parsedUser = JSON.parse(user);
          parsedUser.access_token = newAccessToken;
          localStorage.setItem("user", JSON.stringify(parsedUser));
        } catch (storageError) {
          console.error("Failed to update user session:", storageError);
        }
      }

      return newAccessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const user = localStorage.getItem("user");

  if (user) {
    try {
      const parsedUser = JSON.parse(user);
      const token = parsedUser.access_token;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Invalid user data in localStorage:", error);
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || "";
    const isLoginRequest = requestUrl.includes("/users/login");
    const isRefreshRequest = requestUrl.includes("/users/refresh-token");
    const isLogoutRequest = requestUrl.includes("/users/logout");

    if (
      status === 401 &&
      !isLoginRequest &&
      !isRefreshRequest &&
      !isLogoutRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Refresh token failed:", refreshError);
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;