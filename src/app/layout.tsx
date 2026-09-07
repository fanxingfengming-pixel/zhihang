import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "职航｜大学生 AI 求职实训空间",
  description: "从求职目标到岗位匹配与简历优化，陪大学生走好求职每一步。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
