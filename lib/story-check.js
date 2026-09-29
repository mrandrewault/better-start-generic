import fs from "fs";
import path from "path";

// THE AI STORY CHECK
// Claude reads each story once and decides: keep or cut, why, which topic,
// and how delightful it is. The rules live in two plain-English files that
// Andrew can edit: data/story-rules.md and data/topic-guide.md.

export const STORY_CHECK_MODEL = "claude-haiku-4-5";
export const TOPICS = ["music","sports","fashion","entertainment","business","food","tech","gardening","outdoors","books","beverage","home","crafts","arts","auto","thinking","history","trivia","travel","surprise"];
const BATCH_SIZE = 25;
const SUMMARY_CHARS = 500;

const readData = name => fs.readFileSync(path.join(process.cwd(), "data", name), "utf8");
let cachedRules = null;
export function storyRules() {
  if (!cachedRules) cachedRules = `${readData("story-rules.md")}\n\n---\n\n${readData("topic-guide.md")}`;
  return cachedRules;
}

const VERDICT_TOOL = {
  name: "record_verdicts",
  description: "Record the editor's verdict for every story in the batch, in the same order.",
  input_schema: {
    type: "object",
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {type: "string", description: "The story id exactly as given."},
            safe: {type: "boolean", description: "Passes Test 1 (safety)."},
            delight: {type: "integer", minimum: 1, maximum: 10, description: "Delight score, 1 to 10."},
            keep: {type: "boolean", description: "True only if safe AND delight is 6 or higher."},
            topic: {type: "string", enum: TOPICS},
            reason: {type: "string", description: "One short plain sentence explaining the decision."}
          },
          required: ["id", "safe", "delight", "keep", "topic", "reason"]
        }
      }
    },
    required: ["verdicts"]
  }
};

const clean = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const storyLine = (story, id) => [
  `id: ${id}`,
  `headline: ${clean(story.title)}`,
  `summary: ${clean(story.summary).slice(0, SUMMARY_CHARS) || "(none)"}`,
  `publisher: ${clean(story.source) || "(unknown)"}`,
  `link: ${story.url || ""}`
].join("\n");

async function checkBatch(stories, apiKey) {
  const body = {
    model: STORY_CHECK_MODEL,
    max_tokens: 4096,
    system: [{type: "text", text: storyRules(), cache_control: {type: "ephemeral"}}],
    tools: [VERDICT_TOOL],
    tool_choice: {type: "tool", name: "record_verdicts"},
    messages: [{role: "user", content: `Judge these ${stories.length} stories. Return one verdict per story.\n\n${stories.map((story, index) => storyLine(story, String(index))).join("\n\n")}`}]
  };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {"x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json"},
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Story check failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  const result = await response.json();
  const verdicts = result.content?.find(block => block.type === "tool_use")?.input?.verdicts || [];
  const byId = new Map(verdicts.map(verdict => [String(verdict.id), verdict]));
  return {
    usage: result.usage || {},
    stories: stories.map((story, index) => {
      const verdict = byId.get(String(index));
      // A missing verdict is treated as a cut. Never let an unjudged story through.
      if (!verdict) return {...story, ai: {keep: false, safe: false, delight: 0, topic: "surprise", reason: "No verdict returned.", missing: true}};
      const keep = Boolean(verdict.safe) && Number(verdict.delight) >= 6 && Boolean(verdict.keep);
      return {...story, ai: {keep, safe: Boolean(verdict.safe), delight: Number(verdict.delight) || 0, topic: TOPICS.includes(verdict.topic) ? verdict.topic : "surprise", reason: clean(verdict.reason).slice(0, 240)}};
    })
  };
}

// Judge any number of stories, a batch at a time, a few batches at once.
export async function checkStories(stories, {apiKey = process.env.ANTHROPIC_API_KEY, parallel = 4} = {}) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const batches = [];
  for (let index = 0; index < stories.length; index += BATCH_SIZE) batches.push(stories.slice(index, index + BATCH_SIZE));
  const judged = [], usage = {input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0}, errors = [];
  for (let index = 0; index < batches.length; index += parallel) {
    const results = await Promise.allSettled(batches.slice(index, index + parallel).map(batch => checkBatch(batch, apiKey)));
    results.forEach((result, offset) => {
      if (result.status === "fulfilled") {
        judged.push(...result.value.stories);
        Object.keys(usage).forEach(key => { usage[key] += Number(result.value.usage?.[key]) || 0; });
      } else {
        errors.push(String(result.reason?.message || result.reason));
        judged.push(...batches[index + offset].map(story => ({...story, ai: {keep: false, safe: false, delight: 0, topic: "surprise", reason: "Check failed.", missing: true}})));
      }
    });
  }
  // Claude Haiku 4.5 list price: $1 per million input tokens, $5 per million
  // output tokens; cache reads cost a tenth of input, cache writes 1.25x.
  const cost = (usage.input_tokens * 1 + usage.cache_read_input_tokens * 0.1 + usage.cache_creation_input_tokens * 1.25 + usage.output_tokens * 5) / 1e6;
  return {stories: judged, usage, cost, errors};
}
