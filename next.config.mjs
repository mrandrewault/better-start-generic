export default {
  images: { unoptimized: true },
  // The shared edition is built once during each deploy. Give it time.
  staticPageGenerationTimeout: 180,
  // The feed builders read the source lists in /data at run time. Make sure
  // Vercel ships those files with both routes.
  experimental: {
    outputFileTracingIncludes: {
      "/api/feed": ["./data/**/*"],
      "/api/edition": ["./data/**/*"]
    }
  }
};
