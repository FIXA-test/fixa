import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #F0A03C 0%, #E88A1F 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 118,
        }}
      >
        🔧
      </div>
    ),
    { ...size }
  );
}
