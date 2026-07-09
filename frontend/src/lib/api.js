import axios from 'axios'

const BASE_URL = 'http://localhost:3000'

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshPromise = null

async function refreshAccessToken() {
  const { data } = await axios.post(
    `${BASE_URL}/api/auth/refresh`,
    {},
    { withCredentials: true },
  )
  setAccessToken(data.access_token)
  return data.access_token
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error

    if (response?.status !== 401 || config._retry) {
      return Promise.reject(error)
    }
    config._retry = true

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      config.headers.Authorization = `Bearer ${newToken}`
      return api(config)
    } catch (refreshError) {
      setAccessToken(null)
      window.location.href = '/login'
      return Promise.reject(refreshError)
    }
  },
)

export default api
