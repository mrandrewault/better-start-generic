import { runDaily } from "../../../../lib/social.js";

// THE DAILY SOCIAL JOB. Vercel calls this once a day (see vercel.json).
// It picks the best new story, writes the caption, and loads it into Buffer as
// a DRAFT for Instagram, Threads and TikTok. Nothing is published until Andrew
// approves it in Buffer.
// Only runs on the live site with Vercel's secret handshake, because Buffer
// must be able to fetch the card pictures from meanwhile.now.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ok: false, error: "Not allowed."}, {status: 401});
  try {
    return Response.json(await runDaily());
  } catch (error) {
    return Response.json({ok: false, error: String(error?.message || error)}, {status: 500});
  }
}
