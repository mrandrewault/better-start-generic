import { latestPlans, planPreview, cardUrl, POSTS_PER_DAY, INSTAGRAM_PER_DAY } from "../../../../lib/social.js";

// SOCIAL PREVIEW: a plain page to look at the robot's work.
// Open it to see the latest planned posts with their cards and captions.
// Add ?new=1 to have the robot pick and write 3 fresh sample posts (costs
// about a penny, never sends anything to Buffer).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const when = value => value ? new Date(value).toLocaleString("en-US", {timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}) : "";
const STATUS = {preview: "Sample only", picked: "Picked, not sent", drafted: "Sent to Buffer"};

export async function GET(request) {
  const url = new URL(request.url), origin = url.origin;
  let body = "", note = "";
  try {
    if (url.searchParams.get("new") === "1") {
      // At most one new sample batch every 10 minutes, so nobody can run up the AI bill.
      const recent = (await latestPlans({limit: 1}))[0];
      if (recent?.status === "preview" && Date.now() - new Date(recent.created_at) < 10 * 60e3) throw new Error("Sample posts were just made. Wait 10 minutes for a new batch.");
      const made = await planPreview({count: 3});
      note = made.length ? `Made ${made.length} new sample posts.` : "No new stories good enough today. Try again later.";
    }
    const plans = await latestPlans({limit: 12});
    body = plans.length ? plans.map(plan => `
<article>
  <div class="cards">
    ${[1, 2, 3].map(slide => `<img src="${escape(cardUrl(plan.story_id, "feed", origin, slide))}" alt="Slide ${slide}" loading="lazy">`).join("")}
  </div>
  <div class="words">
    <p class="meta">${escape(STATUS[plan.status] || plan.status)} · ${escape(when(plan.created_at))}${plan.buffer_ids?.length ? ` · ${escape(plan.buffer_ids.map(item => item.service).join(", "))}` : ""}</p>
    <h2><a href="${escape(plan.url)}" target="_blank" rel="noreferrer">${escape(plan.title)}</a></h2>
    <h3>Instagram and TikTok caption</h3><pre>${escape(plan.caption)}</pre>
    <h3>Threads caption</h3><pre>${escape(plan.threads_caption)}</pre>
    ${plan.error ? `<p class="error">${escape(plan.error)}</p>` : ""}
  </div>
</article>`).join("") : `<p>No posts yet. <a href="?new=1">Make 3 sample posts</a>.</p>`;
  } catch (error) {
    body = `<p class="error">${escape(error?.message || error)}</p>`;
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meanwhile social preview</title>
<style>
:root{--bg:#141513;--card:#1d1f1b;--text:#f1ecdf;--muted:#a8a295;--line:#34362f;--cut:#f0a08a}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Georgia,serif;padding:24px 16px 80px}main{max-width:1100px;margin:0 auto}
h1{font-size:32px;margin:0 0 4px}a{color:var(--text)}.muted,.meta{color:var(--muted);font-size:13px}.note{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.button{display:inline-block;border:1px solid var(--text);border-radius:999px;padding:8px 16px;text-decoration:none;margin:10px 0}
article{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:24px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:18px 0}
.cards{display:flex;gap:10px;align-items:flex-start}.cards img{width:32%;border-radius:8px;background:#000}
h2{font-size:20px;margin:4px 0 10px}h3{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}
pre{white-space:pre-wrap;font:14px/1.45 Georgia,serif;margin:0}.error{color:var(--cut)}
@media(max-width:760px){article{grid-template-columns:1fr}}
</style></head><body><main>
<h1>Social preview</h1>
<p class="muted">Every morning the robot schedules ${POSTS_PER_DAY} stories in Buffer: one an hour from 10 AM to 5 PM on Threads and TikTok, and the best ${INSTAGRAM_PER_DAY} on Instagram (plus one Story). To stop a post, delete it from the Buffer Queue before its time.</p>
<a class="button" href="?new=1">Make 3 new sample posts</a>
${note ? `<p class="note">${escape(note)}</p>` : ""}
${body}
</main></body></html>`;
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
}
