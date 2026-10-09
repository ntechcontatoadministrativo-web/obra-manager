/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // As fotos do ponto e do diário sobem por Server Action em data URL (~310 KB
  // cada, limite de 250 KB antes do base64). O padrão do Next é 1 MB: a margem
  // fica explícita aqui para não quebrar em produção se a compressão mudar.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Câmera e GPS serão usados no módulo de Ponto (mesma origem).
        { key: "Permissions-Policy", value: "camera=(self), geolocation=(self)" },
      ],
    }];
  },
};
export default nextConfig;
