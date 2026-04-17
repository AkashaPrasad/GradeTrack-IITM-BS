import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            injectRegister: false,
            includeAssets: ['favicon.svg', 'offline.html'],
            manifest: {
                name: 'GradeTrack',
                short_name: 'GradeTrack',
                description: 'Track grades, assignments, and eligibility for IITM BS courses.',
                theme_color: '#6366f1',
                background_color: '#0a0a0a',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            },
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
            },
            devOptions: { enabled: false }
        })
    ],
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') }
    },
    build: {
        target: 'es2022',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    supabase: ['@supabase/supabase-js'],
                    charts: ['recharts'],
                    motion: ['framer-motion']
                }
            }
        }
    }
});
