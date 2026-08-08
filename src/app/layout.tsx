import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphLoom — Knowledge graphs from your databases",
  description:
    "Connect databases, infer relationships, upload ontologies, and weave multi-project knowledge graphs.",
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
