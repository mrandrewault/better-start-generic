export default {
  images: { unoptimized: true },
  // The feed builders read the source lists in /data at run time. Make sure
  // Vercel ships those files with both routes.
  experimental: {
    outputFileTracingIncludes: {
      "/api/feed": ["./data/**/*"],
      "/api/edition": ["./data/**/*"]
    }
  }
};
