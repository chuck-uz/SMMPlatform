import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: {
    // Default bottom-left collides with the panel sidebar's logout button.
    position: "bottom-right",
  },
};

export default nextConfig;
