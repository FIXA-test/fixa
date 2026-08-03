import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    // Webbläsare (särskilt Chrome) cachar favicon.ico ovanligt aggressivt och
    // ignorerar ofta standard-cachning helt för just den filen. Tvingar en kort
    // max-age + revalidering så en framtida favicon-ändring inte fastnar lika
    // envist i klientens cache som den här gjorde.
    return [
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
      },
      {
        source: "/icon",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
      },
      {
        source: "/apple-icon",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
