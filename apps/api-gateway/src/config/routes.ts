import env from "./env";

/**
 * ServiceConfig defines one downstream microservice.
 *
 * IMPORTANT — how pathRewrite works with app.use():
 *   When Express mounts at `app.use('/auth', proxy)`, it strips '/auth'
 *   before passing the URL to the proxy.  So the proxy sees req.url = '/register',
 *   NOT '/auth/register'.  pathRewrite must match THAT stripped path.
 *
 *   Example:  mountPrefix = '/auth'
 *             incoming:     POST /auth/register
 *             proxy sees:   POST /register         (after Express strips '/auth')
 *             pathRewrite:  { '^/': '/api/v1/auth/' }
 *             final URL:    http://localhost:3001/api/v1/auth/register  ✅
 */
interface ServiceConfig {
    mountPrefix: string;                  // What Express mounts on  e.g. '/auth'
    target: string;                       // Bare host               e.g. 'http://localhost:3001'
    pathRewrite: Record<string, string>;  // Regex → replacement on stripped path
    publicPaths?: string[];               // Sub-paths that skip JWT e.g. ['/register', '/login']
}

export const services: ServiceConfig[] = [
    // ── Auth service ───────────────────────────────────────────────────────
    // app.use('/auth') → proxy sees '/register', rewrites to '/api/v1/auth/register'
    {
        mountPrefix: '/auth',
        target: env.auth_service_url,
        pathRewrite: { '^/': '/api/v1/auth/' },
        publicPaths: ['/register', '/login', '/verify', '/resend-verification', '/rotate-tokens']
    },
    // ── User service ───────────────────────────────────────────────────────
    // app.use('/user') → proxy sees '/search', rewrites to '/api/v1/user/search'
    {
        mountPrefix: '/user',
        target: env.user_service_url,
        pathRewrite: { '^/': '/api/v1/user/' },
        publicPaths: []
    },
    // ── Chat service ───────────────────────────────────────────────────────
    // chat-service mounts at '/chat' internally
    {
        mountPrefix: '/chat',
        target: env.chat_service_url,
        pathRewrite: { '^/': '/chat/' },
        publicPaths: []
    },
    // ── File service ───────────────────────────────────────────────────────
    // file-service mounts at '/files' internally
    {
        mountPrefix: '/file',
        target: env.file_service_url,
        pathRewrite: { '^/': '/files/' },
        publicPaths: []
    },
    // ── Notification service ───────────────────────────────────────────────
    {
        mountPrefix: '/notification',
        target: env.notification_service_url,
        pathRewrite: { '^/': '/notification/' },
        publicPaths: []
    }
];