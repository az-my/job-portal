import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KerjaRadar — Job Aggregator",
  description:
    "Live radar over Indonesian job boards: JobStreet, Dealls, Kalibrr, and Glints aggregated, deduped, and queryable.",
};

const themeScript = `
(() => {
  try {
    const theme = localStorage.getItem("theme");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="scanline" aria-hidden />
        <TopBar />
        <main className="w-full flex-1 px-4 py-7 sm:px-6 lg:px-8 xl:px-10">{children}</main>
      </body>
    </html>
  );
}
