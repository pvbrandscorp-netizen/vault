import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VAULT — Finance",
  description: "Personal & Business Finance Dashboard",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#0B0D12",
          color: "#ddd",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
