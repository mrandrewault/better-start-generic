import { collectCandidates } from "../../../../lib/feed-builder.js";
import { checkStories, STORY_CHECK_MODEL, TOPICS } from "../../../../lib/story-check.js";

// THE REPORT CARD
// A private test page. It pulls about 150 real stories, asks Claude to judge
// them, and shows the results next to what the old word lists decided.
// It only runs on Preview test sites, never on meanwhile.now itself.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SAMPLE = 150;
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const recent = story => !story.date || (Date.now() - new Date(story.date)) / 864e5 <= 7;

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

const row = story => `<tr>
  <td class="headline"><a href="${escape(story.url)}" target="_blank" rel="noreferrer">${escape(story.title)}</a><small>${escape(story.source)}</small></td>
  <td>${escape(story.ai.topic)}</td>
  <td class="score">${escape(story.ai.delight)}</td>
  <td>${escape(story.ai.reason)}</td>
</tr>`;

const table = (title, note, stories, open = true) => `<details ${open ? "open" : ""}>
  <summary><h2>${escape(title)} <span>${stories.length}</span></h2><p>${escape(note)}</p></summary>
  ${stories.length ? `<table><thead><tr><th>Story</th><th>Topic</th><th>Delight</th><th>Why</th></tr></thead><tbody>${stories.map(row).join("")}</tbody></table>` : `<p class="empty">None this time.</p>`}
</details>`;

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return new Response("The report card only runs on Preview test sites.", {status: 404});
  }
  const started = Date.now();
  const {stories: candidates, sourceCount, sourcesWorking} = await collectCandidates();
  const sample = shuffle(candidates.filter(recent)).slice(0, SAMPLE);
  const {stories, cost, usage, errors} = await checkStories(sample);

  const aiKeep = stories.filter(story => story.ai.keep);
  const rescued = stories.filter(story => story.ai.keep && !story.wordList.keep);
  const caught = stories.filter(story => !story.ai.keep && story.wordList.keep);
  const bothKeep = stories.filter(story => story.ai.keep && story.wordList.keep);
  const bothCut = stories.filter(story => !story.ai.keep && !story.wordList.keep);
  const byDelight = list => [...list].sort((a, b) => b.ai.delight - a.ai.delight);
  const topicCounts = TOPICS.map(topic => [topic, aiKeep.filter(story => story.ai.topic === topic).length]);
  const seconds = Math.round((Date.now() - started) / 1000);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meanwhile story check report card</title>
<style>
:root{--bg:#141513;--card:#1d1f1b;--text:#f1ecdf;--muted:#a8a295;--line:#34362f;--keep:#8fd19e;--cut:#f0a08a}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 Georgia,serif;padding:24px 16px 80px}
main{max-width:1100px;margin:0 auto}
h1{font-size:34px;margin:0 0 4px}h2{display:inline;font-size:22px;margin:0}h2 span{color:var(--muted);font-size:18px;margin-left:6px}
p{margin:4px 0}.muted,small{color:var(--muted)}small{display:block;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:24px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}.stat b{display:block;font-size:28px}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0}summary{cursor:pointer;list-style:none}summary p{color:var(--muted)}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:15px}th,td{text-align:left;vertical-align:top;padding:10px 8px;border-top:1px solid var(--line)}
th{color:var(--muted);font-weight:normal;font-size:13px}.headline{width:42%}.score{text-align:center}a{color:var(--text)}
.topics{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.topics span{background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:14px}
.warn{color:var(--cut)}.empty{color:var(--muted);margin-top:10px}
</style></head><body><main>
<h1>Story check report card</h1>
<p class="muted">${stories.length} real stories from ${sourcesWorking} of ${sourceCount} sources, judged by ${escape(STORY_CHECK_MODEL)} in ${seconds} seconds. Cost of this run: about $${cost.toFixed(3)}. Reload the page for a new random sample.</p>
${errors.length ? `<p class="warn">Some batches failed: ${escape(errors.join(" | "))}</p>` : ""}
<div class="stats">
  <div class="stat"><b>${aiKeep.length}</b>AI would keep</div>
  <div class="stat"><b>${stories.length - aiKeep.length}</b>AI would cut</div>
  <div class="stat"><b>${rescued.length}</b>Good stories the word lists wrongly blocked</div>
  <div class="stat"><b>${caught.length}</b>Weak or unsafe stories the word lists let through</div>
</div>
<details open><summary><h2>Topics of the kept stories</h2></summary><div class="topics">${topicCounts.map(([topic, count]) => `<span>${escape(topic)} ${count}</span>`).join("")}</div></details>
${table("Rescued by the AI", "The word lists would have blocked these. The AI says they belong in Meanwhile.", byDelight(rescued))}
${table("Caught by the AI", "The word lists would have let these through. The AI says cut them.", byDelight(caught))}
${table("Both keep", "The word lists and the AI agree these are good.", byDelight(bothKeep), false)}
${table("Both cut", "The word lists and the AI agree these are out.", byDelight(bothCut), false)}
<p class="muted">Tokens: ${usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens} in, ${usage.output_tokens} out.</p>
</main></body></html>`;
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
}
