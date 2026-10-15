import type { NextConfig } from "next";
const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/downloads/nm-ortho-qr.png",
        headers: [{ key: "Content-Disposition", value: 'attachment; filename="NM-Ortho-QR.png"' }],
      },
      {
        source: "/downloads/nm-ortho-qr-print.pdf",
        headers: [{ key: "Content-Disposition", value: 'attachment; filename="NM-Ortho-QR-Print.pdf"' }],
      },
    ];
  },
  serverExternalPackages: ["exceljs", "adm-zip"],
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
};
export default config;
