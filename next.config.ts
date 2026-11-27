import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permet de lancer un second serveur de développement (autre dossier de build) sur la base locale pour les vérifications.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  serverExternalPackages: ['@xenova/transformers'],
};

export default nextConfig;
