import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dictator Mbappé — World Cup XI Builder",
    short_name: "Dictator Mbappé",
    description: "Draft an all-time World Cup XI from 1982–2022 legends and rule the tournament.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070d",
    theme_color: "#05070d",
    icons: [
      { src: "/logo.png", sizes: "525x525", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
