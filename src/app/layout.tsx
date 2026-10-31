import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PantryOven",
    template: "%s | PantryOven",
  },
  description:
    "PantryOven membantu bisnis bakery mengelola inventaris, memantau pergerakan stok, dan mengambil keputusan berdasarkan data.",
  applicationName: "PantryOven",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh min-w-0 flex-col overflow-x-clip">
        {children}
      </body>
    </html>
  );
}