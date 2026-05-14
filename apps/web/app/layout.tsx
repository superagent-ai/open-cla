import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCLA",
  description: "CLA automation, managed templates, and signature visibility for GitHub repositories."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
