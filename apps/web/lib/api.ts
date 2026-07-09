import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

// ─── Shared axios instance ────────────────────────────────────────────────────
export const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,   // send/receive httpOnly refreshToken cookie
})

// Attach accessToken from storage to every request (verified → localStorage, unverified → sessionStorage)
api.interceptors.request.use(config => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
    if (token) config.headers['Authorization'] = `Bearer ${token}`
    return config
})

// On 401 → try token rotation once, then retry the original request
let isRefreshing = false
let queue: Array<(token: string) => void> = []

api.interceptors.response.use(
    res => res,
    async err => {
        const original = err.config
        if (err.response?.status === 401 && !original._retry) {
            original._retry = true

            if (isRefreshing) {
                return new Promise<string>(resolve => {
                    queue.push(resolve)
                }).then(token => {
                    original.headers['Authorization'] = `Bearer ${token}`
                    return api(original)
                })
            }

            isRefreshing = true
            try {
                const { data } = await axios.post(
                    `${BASE_URL}/auth/rotate-tokens`,
                    {},
                    { withCredentials: true }
                )
                const newToken: string = data.data.accessToken
                localStorage.setItem('accessToken', newToken)
                queue.forEach(cb => cb(newToken))
                queue = []
                original.headers['Authorization'] = `Bearer ${newToken}`
                return api(original)
            } catch (err: any) {
                const status = err?.response?.status;
                if (status >= 400 && status < 500) {
                    localStorage.removeItem('accessToken')
                    sessionStorage.removeItem('accessToken')
                }
                queue = []
                // Let the caller handle the error (AuthContext will redirect to /login)
                return Promise.reject(err)
            } finally {
                isRefreshing = false
            }
        }
        return Promise.reject(err)
    }
)
