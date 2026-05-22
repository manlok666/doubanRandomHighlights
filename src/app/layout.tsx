import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Douban Random Highlights",
  description: "输入豆瓣 ID，随机抽取想看电影并展示详情。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full font-sans">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
