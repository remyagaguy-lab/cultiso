import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import DsThemeProvider from "@/components/ui/DsThemeProvider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Cultiso - Intelligence Agrobusiness",
  description:
    "Plateforme d'Intelligence Agrobusiness pour la conquête de la souveraineté alimentaire africaine.",
  openGraph: {
    images: ["/hero-bg.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      data-brand="cultiso"
      data-theme="light"
      data-density="standard"
      className={`${plusJakarta.variable} h-full antialiased bg-background`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("cultiso-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans m-0 p-0 bg-background text-foreground selection:bg-selected selection:text-foreground">
        <AntdRegistry>
          <DsThemeProvider>{children}</DsThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
