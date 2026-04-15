import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Load environment variables based on mode (development/production)
    var env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        css: {
            postcss: {
                plugins: [tailwindcss()],
            },
        },
        server: {
            port: 5174,
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: env.VITE_API_BASE_URL || 'http://localhost:3000',
                    changeOrigin: true,
                    rewrite: function (path) { return path.replace(/^\/api/, '/api'); },
                },
            },
        },
        define: {
            __APP_ENV__: JSON.stringify(env.NODE_ENV || mode),
        },
    };
});
