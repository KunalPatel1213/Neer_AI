import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NEER AI",
    short_name: "NEER AI",
    description: "Your intelligent companion for the sea",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070e1b",
    theme_color: "#070e1b",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
