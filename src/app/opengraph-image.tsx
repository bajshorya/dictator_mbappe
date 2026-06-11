import { ImageResponse } from "next/og";

export const alt = "Dictator Mbappé — build your all-time World Cup XI";
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
          background: "#070b16",
          backgroundImage:
            "radial-gradient(700px 400px at 12% 0%, rgba(251,191,36,0.28), transparent 60%), radial-gradient(700px 400px at 100% 10%, rgba(52,211,153,0.26), transparent 60%), radial-gradient(700px 500px at 50% 120%, rgba(244,114,182,0.22), transparent 60%)",
          color: "#f3f6fb",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 8, color: "#fbbf24", fontWeight: 800 }}>
          ★ ALL-TIME WORLD CUP XI ★
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 132,
            fontWeight: 900,
            lineHeight: 1,
            marginTop: 18,
            letterSpacing: -3,
          }}
        >
          <span style={{ color: "#fde68a" }}>DICTATOR</span>
          <span style={{ color: "#34d399", marginLeft: 24 }}>MBAPPÉ</span>
        </div>
        <div style={{ marginTop: 26, fontSize: 32, color: "#cbd5e1" }}>
          Draft legends 1982–2022 · simulate the tournament · win it all ⚽
        </div>
      </div>
    ),
    { ...size },
  );
}
