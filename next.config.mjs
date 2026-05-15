const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport
    ? {
        output: "export",
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
