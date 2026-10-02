import { runDaily } from "../../../../lib/social.js";

// THE DAILY SOCIAL JOB. Vercel calls this once a day (see vercel.json).
// It picks the best new stories, writes the captions, and loads them into
// Buffer as DRAFTS for Instagram, Threads and TikTok. Nothing is published
// until Andrew approves it in Buffer.
//
// The launch push: open this address with your CRON_SECRET to send a bigger
// batch right now, for example 9 stories:
//   https://meanwhile.now/api/cron/social-drafts?count=9&key=YOUR_CRON_SECRET
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const byVercel = secret && request.headers.get("authorization") === `Bearer ${secret}`;
  const byHand = secret && url.searchParams.get("key") === secret;
  if (!byVercel && !byHand) return Response.json({ok: false, error: "Not allowed."}, {status: 401});
  const count = byHand ? Math.min(12, Math.max(1, Number(url.searchParams.get("count")) || 1)) : undefined;
  try {
    const result = await runDaily(byHand ? {count, force: true} : {});
    // Written to the Vercel log, so a quiet morning can be explained later.
    console.log(`social-drafts: ${JSON.stringify(result).slice(0, 1500)}`);
    return Response.json(result);
  } catch (error) {
    console.error(`social-drafts failed: ${String(error?.message || error)}`);
    return Response.json({ok: false, error: String(error?.message || error)}, {status: 500});
  }
}
