import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;

const nextConfig: NextConfig = {
  ...(staticExport
    ? {
        output: "export" as const,
        images: { unoptimized: true },
      }
    : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  ...(!staticExport
    ? {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
            },
          ];
        },
        async rewrites() {
          return [
            { source: "/api/v1/entities", destination: "/api/v1/entity-list" },
            {
              source: "/api/v1/entities/:id/releases",
              destination: "/api/v1/entity-releases/:id",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
