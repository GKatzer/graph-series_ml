/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output — минимальный bundle для продакшена на VDS с 4GB RAM.
  // При сборке создаёт .next/standalone/ — Node.js сервер без node_modules.
  output: "standalone",

  // NEXT_PUBLIC_* переменные встраиваются в бандл на этапе сборки.
  // NEXT_PUBLIC_API_URL = "/api/backend" — Caddy на VDS2 проксирует это на VDS1.
  // Браузер никогда не видит self-signed сертификат VDS1 напрямую.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "/api/backend",
  },

  // Отключаем телеметрию
  experimental: {
    // Включаем PPR (Partial Pre-rendering) если нужно — пока off
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;