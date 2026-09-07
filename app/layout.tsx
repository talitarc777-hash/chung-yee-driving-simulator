import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "忠義街 · Chung Yee Driving Practice",
  description:
    "Practise observation and vehicle control around Chung Yee Street, Ho Man Tin. Keyboard and Logitech G923 input. Training preview only.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <body className="antialiased">{children}</body>
    </html>
  );
}
