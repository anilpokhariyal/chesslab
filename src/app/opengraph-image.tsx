import { ImageResponse } from "next/og";

export const alt = "ChessLab — analyze, train, and play chess";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#10141a",
          color: "#e8edf4",
        }}
      >
        <div style={{ display: "flex", width: 96, height: 96, borderRadius: 20, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ display: "flex", flexWrap: "wrap", width: 96 }}>
            <div style={{ width: 48, height: 48, background: "#eedeb0" }} />
            <div style={{ width: 48, height: 48, background: "#5a7a48" }} />
            <div style={{ width: 48, height: 48, background: "#5a7a48" }} />
            <div style={{ width: 48, height: 48, background: "#3d9b6e" }} />
          </div>
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -1 }}>ChessLab</div>
        <div style={{ fontSize: 32, color: "#8b97a8", marginTop: 12 }}>Analyze, train, and play chess in your browser.</div>
      </div>
    ),
    size,
  );
}
