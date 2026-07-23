import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Antigravity — Secure Communication System",
  description: "Timeless, encrypted messaging platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#080808] text-[#f4f4f5] selection:bg-white selection:text-black">
        <AuthProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#121212",
              color: "#f4f4f5",
              border: "1px solid #27272a",
              borderRadius: "4px",
              fontSize: "13px",
              fontFamily: "var(--font-geist-mono), monospace",
              boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.8)",
            },
            success: { iconTheme: { primary: "#ffffff", secondary: "#000000" } },
            error: { iconTheme: { primary: "#f87171", secondary: "#121212" } },
          }}
        />
      </body>
    </html>
  );
}
