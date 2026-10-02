import { pantryDb } from "../../../../lib/pantry.js";
import { videoSources, videoSpentToday, VIDEO_DAILY_BUDGET_USD } from "../../../../lib/video-pantry.js";
import { TV_CHANNELS, TV_CHANNEL_NAMES } from "../../../../lib/video-check.js";

// MEANWHILE TV STATUS: what is on the video shelf, which source channels are
// earning their place (the video version of the source tryout), and what the
// background job has been doing. Read-only.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const when = value => value ? new Date(value).toLocaleString("en-US", {timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}) : "–";
const pct = value => `${Math.round(value * 100)}%`;

export async function GET() {
  let body;
  try {
    const db = pantryDb(), now = new Date().toISOString();
    const [shelfResult, runsResult, checkedResult, keptResult, channelsResult, spent] = await Promise.all([
      db.from("video_inventory").select("tv_channel").eq("ai_keep", true).gt("shelf_until", now).limit(20000),
      db.from("video_runs").select("*").order("started_at", {ascending: false}).limit(10),
      db.from("video_inventory").select("source_key, channel_name, ai_keep, ai_delight").limit(30000),
      db.from("video_inventory").select("id, title, channel_name, tv_channel, intro, ai_delight, thumbnail").eq("ai_keep", true).order("checked_at", {ascending: false}).limit(24),
      db.from("video_channels").select("key, title, error"),
      videoSpentToday(db)
    ]);
    const shelf = shelfResult.data || [], runs = runsResult.data || [];
    const counts = TV_CHANNELS.map(id => [id, shelf.filter(row => row.tv_channel === id).length]);

    // Per-source grades: keep rate and average delight.
    const bySource = new Map();
    (checkedResult.data || []).forEach(row => {
      const entry = bySource.get(row.source_key) || {name: row.channel_name, total: 0, kept: 0, delight: 0};
      entry.total += 1; entry.kept += row.ai_keep ? 1 : 0; entry.delight += Number(row.ai_delight || 0);
      bySource.set(row.source_key, entry);
    });
    const lookups = new Map((channelsResult.data || []).map(row => [row.key, row]));
    const sources = videoSources().map(source => {
      const key = source.id || source.handle.toLowerCase();
      const stats = bySource.get(key), lookup = lookups.get(key);
      const status = source.id || lookup?.title ? "ok" : lookup?.error ? "not found" : "waiting";
      const keepRate = stats?.total ? stats.kept / stats.total : 0;
      const grade = !stats?.total ? (status === "not found" ? "Remove" : "Waiting") : keepRate >= 0.5 ? "Great" : keepRate >= 0.25 ? "OK" : "Weak";
      return {label: source.name || lookup?.title || source.handle, handle: source.handle || "", channel: source.channel, status, total: stats?.total || 0, kept: stats?.kept || 0, keepRate, delight: stats?.total ? stats.delight / stats.total : 0, grade};
    }).sort((a, b) => (b.kept - a.kept) || a.label.localeCompare(b.label));
    const gradeCount = label => sources.filter(source => source.grade === label).length;

    body = `
<p class="muted">Updated ${escape(when(new Date()))} (New York time). ${sources.length} source channels. Reload for the latest.</p>
<div class="stats">
  <div class="stat"><b>${shelf.length}</b>videos on the shelf</div>
  <div class="stat"><b>$${spent.toFixed(2)}</b>spent today (cap $${VIDEO_DAILY_BUDGET_USD})</div>
  <div class="stat"><b>${gradeCount("Great") + gradeCount("OK")}</b>sources earning their place</div>
  <div class="stat"><b>${gradeCount("Remove")}</b>sources not found</div>
</div>
<section><h2>Shelf by TV channel</h2><div class="topics">${counts.map(([id, count]) => `<span class="${count < 15 ? "thin" : ""}">${escape(TV_CHANNEL_NAMES[id])} ${count}</span>`).join("")}</div></section>
<section><h2>Just added</h2><div class="grid">${(keptResult.data || []).map(video => `
  <a class="video" href="https://www.youtube.com/watch?v=${escape(video.id)}" target="_blank" rel="noreferrer">
    <img src="${escape(video.thumbnail)}" alt="" loading="lazy">
    <b>Meanwhile, ${escape(video.intro || video.title)}</b>
    <small>${escape(TV_CHANNEL_NAMES[video.tv_channel] || video.tv_channel)} · ${escape(video.channel_name)} · delight ${escape(video.ai_delight)}</small>
  </a>`).join("")}</div></section>
<section><h2>Recent runs</h2><table><thead><tr><th>Started</th><th>Sources</th><th>Videos read</th><th>New</th><th>Judged</th><th>Kept</th><th>Cost</th><th>Notes</th></tr></thead><tbody>
${runs.map(run => `<tr><td>${escape(when(run.started_at))}</td><td>${escape(run.sources ?? "–")}</td><td>${escape(run.fetched ?? "–")}</td><td>${escape(run.new_videos ?? "–")}</td><td>${escape(run.judged ?? "–")}</td><td>${escape(run.kept ?? "–")}</td><td>$${Number(run.cost_usd || 0).toFixed(3)}</td><td>${escape(run.notes || "")}</td></tr>`).join("")}
</tbody></table></section>
<section><h2>Source report card</h2><p class="muted">Great = half or more of its videos kept. Weak = under a quarter. Remove = the channel could not be found.</p>
<table><thead><tr><th>Source</th><th>TV channel</th><th>Grade</th><th>Checked</th><th>Kept</th><th>Keep rate</th><th>Delight</th></tr></thead><tbody>
${sources.map(source => `<tr class="g-${source.grade.toLowerCase()}"><td>${escape(source.label)}<small>${escape(source.handle)}</small></td><td>${escape(TV_CHANNEL_NAMES[source.channel] || source.channel)}</td><td class="grade">${escape(source.grade)}</td><td>${source.total}</td><td>${source.kept}</td><td>${source.total ? pct(source.keepRate) : "–"}</td><td>${source.total ? source.delight.toFixed(1) : "–"}</td></tr>`).join("")}
</tbody></table></section>`;
  } catch (error) {
    body = `<p class="cut">The video pantry could not be reached: ${escape(error?.message || error)}. Did the TV setup SQL run?</p>`;
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meanwhile TV status</title>
<style>
:root{--bg:#141513;--card:#1d1f1b;--text:#f1ecdf;--muted:#a8a295;--line:#34362f;--keep:#8fd19e;--cut:#f0a08a}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Georgia,serif;padding:24px 16px 80px}main{max-width:1200px;margin:0 auto}
h1{font-size:32px;margin:0 0 4px}h2{font-size:20px;margin:0 0 10px}.muted,small{color:var(--muted)}small{display:block;font-size:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:20px 0}.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}.stat b{display:block;font-size:24px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0;overflow-x:auto}
.topics{display:flex;flex-wrap:wrap;gap:8px}.topics span{border:1px solid var(--line);border-radius:999px;padding:2px 10px}.topics .thin{color:var(--cut)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}.video{color:var(--text);text-decoration:none}.video img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;margin-bottom:6px}.video b{font-size:14px;line-height:1.3;display:block}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:680px}th,td{text-align:left;padding:7px 6px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:normal}
.grade{font-weight:bold}.g-great .grade{color:var(--keep)}.g-weak .grade,.g-remove .grade{color:var(--cut)}.cut{color:var(--cut)}
</style></head><body><main><h1>Meanwhile TV status</h1>${body}</main></body></html>`;
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
}
