import { ImageResponse } from "next/og";

export const alt = "Footy — build your all-time World Cup XI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(1200px 600px at 50% -10%, #14304a 0%, #07111b 60%, #05070d 100%)",
          color: "#eef2f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 150, fontWeight: 900, color: "#34d399", letterSpacing: -4 }}>FOOTY ⚽</div>
        <div style={{ marginTop: 16, fontSize: 40, color: "#cbd5e1" }}>
          Draft an all-time World Cup XI
        </div>
        <div style={{ marginTop: 8, fontSize: 28, color: "#64748b" }}>
          1982–2022 legends · simulate the tournament · win it all
        </div>
      </div>
    ),
    { ...size },
  );
}
