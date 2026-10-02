import { runDaily } from "../../../../lib/social.js";

// THE DAILY SOCIAL JOB. Vercel calls this at 7:05 AM New York time (see vercel.json).
// It picks the 8 best new stories, writes the captions, and SCHEDULES them in
// Buffer: one an hour from 10 AM to 5 PM on Threads and TikTok, and the best 4
// on Instagram (10, 12, 2, 4) plus one Story. Andrew can delete any post from
// the Buffer Queue before its time; otherwise it publishes on its own.
//
// The launch push: open this address with your CRON_SECRET to send a bigger
// batch right now as DRAFTS (nothing posts until approved), for example 9:
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
