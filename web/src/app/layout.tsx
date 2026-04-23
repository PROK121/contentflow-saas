import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GROWIX CONTENT GROUP — дистрибуция и лицензии",
  description:
    "GROWIX CONTENT GROUP: сделки, каталог прав, контракты, выплаты",
  icons: {
    icon: [
      { url: "/brand/growix-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/growix-logo.png", type: "image/png" },
    ],
    shortcut: ["/brand/growix-favicon.svg", "/brand/growix-logo.png"],
    apple: "/brand/growix-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
