import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grupo Ta'On - Controle de Estoque",
  description: "Sistema de controle de estoque para Isla, Playa e Aura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.className} h-full`}>
      <body className="min-h-full bg-gray-50">
        <Sidebar />
        <main className="sidebar-main min-h-screen">
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
