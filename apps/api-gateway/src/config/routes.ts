import env from "./env";
interface RouteConfig {
    prefix: string;        // e.g. "/auth"
    target: string;        // e.g. env.auth_service_url
    protected: boolean;    // run jwtVerifyMiddleware before proxying?
}

export const routes: RouteConfig[] = [
    {
        prefix: '/auth/register',
        target: env.auth_service_url,
        protected: false
    },
    {
        prefix: '/auth/login',
        target: env.auth_service_url,
        protected: false
    },
    {
        prefix: '/auth/verify/:token',
        target: env.auth_service_url,
        protected: false
    },
    {
        prefix: '/auth',
        target: env.auth_service_url,
        protected: true
    },
    {
        prefix: '/user',
        target: env.user_service_url,
        protected: true
    },
    {
        prefix: '/chat',
        target: env.chat_service_url,
        protected: true
    },
    {
        prefix: '/file',
        target: env.file_service_url,
        protected: true
    },
    {
        prefix: '/notification',
        target: env.notification_service_url,
        protected: true
    }
]