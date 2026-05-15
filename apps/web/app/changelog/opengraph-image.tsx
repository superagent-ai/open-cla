import { ImageResponse } from "next/og";

export const alt = "OpenCLA changelog";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f8f8f7",
          color: "#111111",
          display: "flex",
          fontFamily: "Inter, Arial, sans-serif",
          height: "100%",
          justifyContent: "center",
          padding: 64,
          width: "100%"
        }}
      >
        <div
          style={{
            borderTop: "1px solid #dededb",
            display: "flex",
            gap: 72,
            paddingTop: 76,
            width: "100%"
          }}
        >
          <div
            style={{
              color: "#9a9a95",
              display: "flex",
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              width: 210
            }}
          >
            May 2026
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 760 }}>
            <div
              style={{
                alignItems: "center",
                background: "#111111",
                borderRadius: 999,
                color: "#ffffff",
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                height: 54,
                justifyContent: "center",
                letterSpacing: "-0.03em",
                width: 158
              }}
            >
              OpenCLA
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 82,
                  fontWeight: 700,
                  letterSpacing: "-0.075em",
                  lineHeight: 0.95
                }}
              >
                Changelog
              </div>
              <div
                style={{
                  color: "#4b4b48",
                  display: "flex",
                  fontSize: 34,
                  fontWeight: 500,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.22,
                  maxWidth: 680
                }}
              >
                Latest OpenCLA updates, releases, and improvements.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
