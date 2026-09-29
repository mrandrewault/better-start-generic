import Parser from "rss-parser";
import fs from "fs";
import path from "path";
import { checkStories } from "../../../../lib/story-check.js";

// SOURCE TRYOUT
// Test-drives candidate sources before they join Meanwhile. For each feed it
// pulls the latest stories, runs the real AI story check, and grades the
// source: does the feed work, how fresh is it, what share of its stories
// the AI would keep, how delightful they are, and how many have pictures.
// Candidates live in data/candidate-sources.json. Preview test sites only.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PER_SOURCE = 8;
const parser = new Parser({timeout: 8000, headers: {"User-Agent": "Meanwhile/1.0 (+https://meanwhile.now)"}, customFields: {item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"]]}});
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const plain = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/&\w+;/g, " ").replace(/\s+/g, " ").trim();
const hasImage = item => Boolean(item.enclosure?.url || item.mediaContent || item.mediaThumbnail || /<img\s/i.test(item["content:encoded"] || item.content || ""));
const daysOld = date => date ? (Date.now() - new Date(date)) / 864e5 : Infinity;

export async function GET() {
  if (process.env.VERCEL_ENV === "production") return new Response("Source tryout only runs on Preview test sites.", {status: 404});
  const started = Date.now();
  const candidates = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "candidate-sources.json"), "utf8"));

  const fetched = await Promise.all(candidates.map(async source => {
    try {
      const feed = await parser.parseURL(source.url);
      const items = (feed.items || []).map(item => ({
        title: plain(item.title) || "Untitled", url: item.link || "#", summary: plain(item.contentSnippet || item.content || "").slice(0, 600),
        date: item.isoDate || item.pubDate || null, source: source.name, image: hasImage(item), sourceUrl: source.url
      }));
      const newest = Math.min(...items.map(item => daysOld(item.date)));
      const perWeek = items.filter(item => daysOld(item.date) <= 7).length;
      return {...source, ok: true, newest, perWeek, stories: items.slice(0, PER_SOURCE)};
    } catch (error) {
      return {...source, ok: false, error: String(error?.message || error).slice(0, 120), stories: []};
    }
  }));

  const allStories = fetched.flatMap(source => source.stories);
  const {stories: judged, cost, errors} = await checkStories(allStories, {parallel: 6});
  const bySource = new Map();
  judged.forEach(story => { if (!bySource.has(story.sourceUrl)) bySource.set(story.sourceUrl, []); bySource.get(story.sourceUrl).push(story); });

  const graded = fetched.map(source => {
    const stories = bySource.get(source.url) || [];
    const kept = stories.filter(story => story.ai.keep);
    const keepRate = stories.length ? kept.length / stories.length : 0;
    const delight = stories.length ? stories.reduce((sum, story) => sum + story.ai.delight, 0) / stories.length : 0;
    const imageRate = stories.length ? stories.filter(story => story.image).length / stories.length : 0;
    const fresh = source.ok && source.newest <= 14;
    // Grade: keep rate matters most, then delight, then pictures. Stale or
    // broken feeds fail regardless.
    const score = !source.ok || !fresh || !stories.length ? 0 : Math.round(keepRate * 60 + (delight / 10) * 25 + imageRate * 15);
    const verdict = !source.ok ? "Feed broken" : !fresh ? "Stale" : score >= 65 ? "Add" : score >= 45 ? "Maybe" : "Skip";
    return {...source, stories, kept, keepRate, delight, imageRate, score, verdict};
  }).sort((a, b) => b.score - a.score);

  const counts = ["Add", "Maybe", "Skip", "Stale", "Feed broken"].map(label => [label, graded.filter(source => source.verdict === label).length]);
  const pct = value => `${Math.round(value * 100)}%`;
  const rows = graded.map(source => `<tr class="v-${escape(source.verdict.replace(/\s/g, "").toLowerCase())}">
    <td><b>${escape(source.name)}</b><small>${escape(source.topic)} · ${escape(source.country)}${source.independent ? " · independent" : ""}</small></td>
    <td class="verdict">${escape(source.verdict)}<small>${source.score}</small></td>
    <td>${source.ok ? pct(source.keepRate) : "–"}</td>
    <td>${source.ok && source.stories.length ? source.delight.toFixed(1) : "–"}</td>
    <td>${source.ok ? pct(source.imageRate) : "–"}</td>
    <td>${source.ok ? `${source.perWeek}/wk<small>newest ${Number.isFinite(source.newest) ? Math.round(source.newest) + "d" : "?"}</small>` : `<small>${escape(source.error || "")}</small>`}</td>
    <td class="samples">${source.stories.slice(0, 4).map(story => `<div class="${story.ai.keep ? "keep" : "cut"}">${story.ai.keep ? "Keep" : "Cut"}: <a href="${escape(story.url)}" target="_blank" rel="noreferrer">${escape(story.title)}</a></div>`).join("")}</td>
  </tr>`).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meanwhile source tryout</title>
<style>
:root{--bg:#141513;--card:#1d1f1b;--text:#f1ecdf;--muted:#a8a295;--line:#34362f;--keep:#8fd19e;--cut:#f0a08a}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 Georgia,serif;padding:24px 16px 80px}main{max-width:1250px;margin:0 auto}
h1{font-size:32px;margin:0 0 4px}.muted,small{color:var(--muted)}small{display:block;font-size:12px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}.stat b{font-size:22px;margin-right:6px}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:900px}th,td{text-align:left;vertical-align:top;padding:9px 8px;border-top:1px solid var(--line)}th{color:var(--muted);font-weight:normal;font-size:12px}
.verdict{font-weight:bold}.v-add .verdict{color:var(--keep)}.v-skip .verdict,.v-feedbroken .verdict,.v-stale .verdict{color:var(--cut)}
.samples{width:42%;font-size:13px}.samples div{margin-bottom:3px}.keep{color:var(--keep)}.cut{color:var(--cut)}a{color:var(--text)}
</style></head><body><main>
<h1>Source tryout</h1>
<p class="muted">${graded.length} candidate sources, ${judged.length} stories judged in ${Math.round((Date.now() - started) / 1000)} seconds. Cost of this run: about $${cost.toFixed(2)}.</p>
${errors.length ? `<p class="cut">Some AI batches failed: ${escape(errors.slice(0, 3).join(" | "))}</p>` : ""}
<div class="stats">${counts.map(([label, count]) => `<div class="stat"><b>${count}</b>${escape(label)}</div>`).join("")}</div>
<p class="muted">Score = keep rate (60%) + delight (25%) + pictures (15%). Add = 65 or more. Maybe = 45 to 64. Broken or stale feeds (nothing in 14 days) score 0.</p>
<div class="wrap"><table><thead><tr><th>Source</th><th>Verdict</th><th>Keep rate</th><th>Delight</th><th>Pictures</th><th>Freshness</th><th>Sample stories</th></tr></thead><tbody>${rows}</tbody></table></div>
</main></body></html>`;
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
}
