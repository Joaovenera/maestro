import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["82.29.57.50"],
  async rewrites() {
    const apiBase = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBase}/api/v1/:path*`,
      },
      {
        source: "/webhooks/coolify",
        destination: `${apiBase}/webhooks/coolify`,
      },
    ]
  },
}

export default nextConfig
