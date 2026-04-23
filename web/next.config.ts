import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Каталог приложения `web/` — убирает предупреждение при нескольких lockfile в дереве каталогов. */
const webRoot = path.dirname(fileURLToPath(import.meta.url));

const apiOrigin = (
  process.env.API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    root: webRoot,
  },
  /**
   * Запросы к http://localhost:3020/v1/* проксируются на Nest API.
   * Так в браузере по адресу веб-порта открывается JSON API (а не 404 Next).
   */
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiOrigin}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
