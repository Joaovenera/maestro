import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
