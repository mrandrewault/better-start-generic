import { stockVideos } from "../../../../lib/video-pantry.js";

// MEANWHILE TV BACKGROUND JOB. Vercel calls this every hour (see vercel.json).
// It reads the latest videos from every source channel, has the AI check the
// new ones, and stocks the TV shelf. On Preview test sites it can be run by
// hand by opening this address.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  const authorized = isPreview || (secret && (request.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("key") === secret));
  if (!authorized) return Response.json({ok: false, error: "Not allowed."}, {status: 401});
  try {
    const summary = await stockVideos();
    console.log(`stock-videos: ${JSON.stringify(summary)}`);
    return Response.json({ok: true, ...summary});
  } catch (error) {
    console.error(`stock-videos failed: ${String(error?.message || error)}`);
    return Response.json({ok: false, error: String(error?.message || error)}, {status: 500});
  }
}
