import { cardData } from "../../../../lib/social.js";
import { ensureVideo } from "../../../../lib/social-video.js";
import { pantryDb } from "../../../../lib/pantry.js";

// THE MOVING TIKTOK CARD for one story.
// /api/social/video?id=<story id>          opens the video (makes it first if needed)
// /api/social/video?id=<story id>&json=1   answers with its address (used by the daily robot)
// It only makes videos for stories the social robot has already planned.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const id = String(params.get("id") || "").slice(0, 40);
  const json = params.get("json") === "1";
  const fail = (message, status) => json ? Response.json({ok: false, error: message}, {status}) : new Response(message, {status});
  try {
    const db = pantryDb();
    const {data: plan} = id ? await db.from("social_posts").select("id").eq("story_id", id).limit(1).maybeSingle() : {data: null};
    const card = plan ? await cardData(id) : null;
    if (!card) return fail("No social post for that story.", 404);
    const started = Date.now();
    const video = await ensureVideo(id, card, {db});
    if (video.made) console.log(`social-video: made ${id} in ${Date.now() - started} ms, ${video.bytes} bytes`);
    return json ? Response.json({ok: true, ...video}) : Response.redirect(video.url, 302);
  } catch (error) {
    console.error(`social-video failed for ${id}: ${String(error?.message || error)}`);
    return fail(`Video failed: ${String(error?.message || error)}`, 500);
  }
}
