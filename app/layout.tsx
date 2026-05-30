import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aussie Property Lookup",
  description: "Australian property intelligence — search by address",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}