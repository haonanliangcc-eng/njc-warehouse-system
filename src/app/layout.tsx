import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NJC仓运营数据中心",
  description: "NJC仓库交接、货量、劳务、异常、清关和发货流水管理"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
