import type { Metadata } from "next";
import { Inter, Fredoka } from "next/font/google";
import { SidebarProvider } from "@/components/SidebarContext";
import { LayoutContainer } from "@/components/LayoutContainer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Club 5 Cantina Escolar | Punto de Venta (POS)",
  description:
    "Sistema de Punto de Venta ágil y moderno para la cantina escolar de Club 5 con conversión BCV en tiempo real.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/club5logo-transparent.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Club 5 POS",
  },
  openGraph: {
    title: "Club 5 Cantina Escolar | Punto de Venta (POS)",
    description:
      "Punto de Venta para cantina escolar con gestión de inventario, clientes y cálculo en Bolívares y Dólares con tasa BCV.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined') {
                  var origSet = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, val) {
                    if (typeof name === 'string' && (name.indexOf('bis_') === 0 || name.indexOf('__processed_') === 0)) {
                      return;
                    }
                    return origSet.apply(this, arguments);
                  };
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col font-sans bg-[#FAFAFA] text-slate-900 antialiased selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden"
        suppressHydrationWarning
      >
        <SidebarProvider>
          <LayoutContainer>{children}</LayoutContainer>
        </SidebarProvider>
      </body>
    </html>
  );
}
