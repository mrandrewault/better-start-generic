import { pantryDb, spentToday, DAILY_BUDGET_USD } from "../../../../lib/pantry.js";
import { TOPICS } from "../../../../lib/story-check.js";

// PANTRY STATUS: a plain page showing what is on the shelf, what the
// background job has been doing, and what it cost. Read-only.
export const dynamic = "force-dynamic";

const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const when = value => value ? new Date(value).toLocaleString("en-US", {timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}) : "–";

export async function GET() {
  let body;
  try {
    const db = pantryDb(), now = new Date().toISOString();
    const [shelfResult, runsResult, keptResult, cutResult, spent] = await Promise.all([
      db.from("story_inventory").select("ai_topic, image").eq("ai_keep", true).gt("shelf_until", now).limit(5000),
      db.from("check_runs").select("*").order("started_at", {ascending: false}).limit(12),
      db.from("story_inventory").select("title, url, source, ai_topic, ai_delight, ai_reason").eq("ai_keep", true).order("checked_at", {ascending: false}).limit(15),
      db.from("story_inventory").select("title, url, source, ai_delight, ai_reason").eq("ai_keep", false).order("checked_at", {ascending: false}).limit(15),
      spentToday(db)
    ]);
    const shelf = shelfResult.data || [], runs = runsResult.data || [];
    const withImages = shelf.filter(row => row.image).length;
    const topics = TOPICS.map(topic => [topic, shelf.filter(row => row.ai_topic === topic).length]);
    const list = rows => (rows || []).map(row => `<li><a href="${escape(row.url)}" target="_blank" rel="noreferrer">${escape(row.title)}</a> <small>${escape(row.source)}${row.ai_topic ? ` · ${escape(row.ai_topic)}` : ""} · delight ${escape(row.ai_delight)} · ${escape(row.ai_reason)}</small></li>`).join("");
    body = `
<p class="muted">Updated ${escape(when(new Date()))} (New York time). Reload for the latest.</p>
<div class="stats">
  <div class="stat"><b>${shelf.length}</b>stories on the shelf</div>
  <div class="stat"><b>${shelf.length ? Math.round(withImages / shelf.length * 100) : 0}%</b>have pictures</div>
  <div class="stat"><b>$${spent.toFixed(2)}</b>spent today (cap $${DAILY_BUDGET_USD})</div>
  <div class="stat"><b>${runs[0] ? escape(when(runs[0].started_at)) : "never"}</b>last run</div>
</div>
<section><h2>Shelf by topic</h2><div class="topics">${topics.map(([topic, count]) => `<span class="${count < 5 ? "thin" : ""}">${escape(topic)} ${count}</span>`).join("")}</div></section>
<section><h2>Recent runs</h2><table><thead><tr><th>Started</th><th>Sources</th><th>New</th><th>Judged</th><th>Kept</th><th>Cost</th><th>Notes</th></tr></thead><tbody>
${runs.map(run => `<tr><td>${escape(when(run.started_at))}</td><td>${escape(run.sources ?? "–")}</td><td>${escape(run.new_stories ?? "–")}</td><td>${escape(run.judged ?? "–")}</td><td>${escape(run.kept ?? "–")}</td><td>$${Number(run.cost_usd || 0).toFixed(3)}</td><td>${escape(run.notes || "")}</td></tr>`).join("")}
</tbody></table></section>
<section><h2>Just kept</h2><ul class="keep">${list(keptResult.data)}</ul></section>
<section><h2>Just cut</h2><ul class="cut">${list(cutResult.data)}</ul></section>`;
  } catch (error) {
    body = `<p class="cut">The pantry could not be reached: ${escape(error?.message || error)}</p>`;
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meanwhile pantry status</title>
<style>
:root{--bg:#141513;--card:#1d1f1b;--text:#f1ecdf;--muted:#a8a295;--line:#34362f;--keep:#8fd19e;--cut:#f0a08a}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Georgia,serif;padding:24px 16px 80px}main{max-width:1100px;margin:0 auto}
h1{font-size:32px;margin:0 0 4px}h2{font-size:20px;margin:0 0 10px}.muted,small{color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:20px 0}.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}.stat b{display:block;font-size:24px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0;overflow-x:auto}
.topics{display:flex;flex-wrap:wrap;gap:8px}.topics span{border:1px solid var(--line);border-radius:999px;padding:2px 10px}.topics .thin{color:var(--cut)}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}th,td{text-align:left;padding:7px 6px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:normal}
ul{margin:0;padding-left:18px}li{margin-bottom:6px}a{color:var(--text)}.keep a{border-bottom:1px solid var(--keep)}.cut a{border-bottom:1px solid var(--cut)}.cut{color:var(--cut)}
</style></head><body><main><h1>Pantry status</h1>${body}</main></body></html>`;
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
}
