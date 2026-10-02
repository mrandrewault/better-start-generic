export default {
  images: { unoptimized: true },
  // The shared edition is built once during each deploy. Give it time.
  staticPageGenerationTimeout: 180,
  // The feed builders read the source lists in /data at run time. Make sure
  // Vercel ships those files with both routes.
  experimental: {
    outputFileTracingIncludes: {
      "/api/feed": ["./data/**/*"],
      "/api/edition": ["./data/**/*"],
      "/api/story-check/report": ["./data/**/*"],
      "/api/sources/tryout": ["./data/**/*"],
      "/api/cron/stock-pantry": ["./data/**/*"],
      "/api/pantry/status": ["./data/**/*"],
      "/api/social/card": ["./data/**/*"],
      "/api/social/preview": ["./data/**/*"],
      "/api/cron/social-drafts": ["./data/**/*"],
      "/api/cron/stock-videos": ["./data/**/*"],
      "/api/tv/status": ["./data/**/*"],
      "/api/tv/lineup": ["./data/**/*"],
      // The TikTok video maker also needs the ffmpeg program.
      "/api/social/video": ["./data/**/*", "./node_modules/.pnpm/@ffmpeg-installer+linux-x64@4.1.0/node_modules/@ffmpeg-installer/linux-x64/**"]
    }
  }
};
