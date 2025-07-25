import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
