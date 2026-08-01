import type { Metadata } from "next";
import ToastProvider from "@/components/providers/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Insurance Management Platform",
  description: "Secure authentication for the insurance management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
