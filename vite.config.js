// vite.config.js
export default {
    server: {
        proxy: {
            '/met-img': {
                target: 'https://images.metmuseum.org',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/met-img/, ''),
            },
        },
    },
};
