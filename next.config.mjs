/** @type {import('next').NextConfig} */
const nextConfig = {
  // O markup do dashboard (app/body.html) é lido via fs em runtime no Server Component.
  // Forçamos o tracer de output do Next a incluí-lo no bundle (necessário p/ Vercel).
  outputFileTracingIncludes: {
    '/': ['./app/body.html'],
  },
};

export default nextConfig;
