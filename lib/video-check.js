import { storyRules, STORY_CHECK_MODEL } from "./story-check.js";

// THE AI VIDEO CHECK
// The same editor that checks news stories, now checking videos. For each
// video it decides keep or cut, how delightful it is, which Meanwhile TV
// channel it belongs on, where in the world it happens, and writes the little
// title card that plays before it: "Meanwhile, in Norway, ..."

export const TV_CHANNELS = ["animals", "nature", "music", "makers", "food", "wow", "travel", "art", "people", "wheels"];
export const TV_CHANNEL_NAMES = {
  animals: "Animals", nature: "Nature", music: "Music", makers: "Makers", food: "Food",
  wow: "Wow", travel: "Travel", art: "Art + Design", people: "Good People", wheels: "Wheels"
};
const BATCH_SIZE = 20;

const VIDEO_RULES = `
---

# Extra rules for VIDEOS (Meanwhile TV)

You are now judging YouTube videos for Meanwhile TV, a full-screen channel people watch with their morning coffee. Apply every rule above, plus:

- Keep: performances, craft and making, animals, nature, food, travel, art, science wonders, kind people, beautiful places, clever ideas.
- Cut: shopping hauls, product reviews and unboxings, sponsored ads, giveaways, livestream replays, trailers, channel updates ("we're moving", "Q&A", "announcement"), reaction videos, pranks, clickbait ("you won't believe"), anything over the top or shouty.
- Cut anything sad, scary, gross, medical, or about injury, illness, death or animals in danger without a happy ending shown in the title.
- Judge from the title, description and channel. If you are unsure, cut it.
- delight: 1 to 10, how happy or amazed a stranger would feel watching this over coffee.
- channel: the best Meanwhile TV channel for it.
- place: where it happens, as a reader would say it ("Norway", "Kyoto, Japan", "a Vermont farm", "the deep sea", "a garage in Ohio"). Empty if you cannot tell.
- intro: the title card shown before the video. It is printed right after "Meanwhile," so it must continue that sentence. Start with the place when there is one ("in Norway, a baker builds a gingerbread fjord"). 5 to 12 words, lowercase start unless a name, no period, no exclamation points, no dashes, faithful to the video, never clickbait.`;

const VERDICT_TOOL = {
  name: "record_verdicts",
  description: "Record a verdict for every video in the batch, in the same order.",
  input_schema: {
    type: "object",
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {type: "string"},
            safe: {type: "boolean"},
            delight: {type: "integer", minimum: 1, maximum: 10},
            keep: {type: "boolean", description: "True only if safe AND delight is 6 or higher."},
            channel: {type: "string", enum: TV_CHANNELS},
            place: {type: "string"},
            intro: {type: "string"},
            reason: {type: "string", description: "One short plain sentence."}
          },
          required: ["id", "safe", "delight", "keep", "channel", "place", "intro", "reason"]
        }
      }
    },
    required: ["verdicts"]
  }
};

const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const tidy = value => clean(value).replace(/\s*[—–]\s*/g, ", ").replace(/!+/g, "").replace(/[.]$/, "");

async function checkBatch(videos, apiKey) {
  const list = videos.map((video, index) => [
    `id: ${index}`, `title: ${clean(video.title)}`, `channel: ${clean(video.channelName)}`,
    `description: ${clean(video.description).slice(0, 400) || "(none)"}`, `suggested channel: ${video.suggested}`
  ].join("\n")).join("\n\n");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {"x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json"},
    body: JSON.stringify({
      model: STORY_CHECK_MODEL, max_tokens: 6000,
      system: [{type: "text", text: `${storyRules()}\n${VIDEO_RULES}`, cache_control: {type: "ephemeral"}}],
      tools: [VERDICT_TOOL], tool_choice: {type: "tool", name: "record_verdicts"},
      messages: [{role: "user", content: `Judge these ${videos.length} videos. One verdict per video.\n\n${list}`}]
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Video check failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  const result = await response.json();
  const verdicts = result.content?.find(block => block.type === "tool_use")?.input?.verdicts || [];
  const byId = new Map(verdicts.map(verdict => [String(verdict.id), verdict]));
  return {
    usage: result.usage || {},
    videos: videos.map((video, index) => {
      const verdict = byId.get(String(index));
      if (!verdict) return {...video, ai: null};          // no answer: try again next run
      const keep = Boolean(verdict.keep && verdict.safe && Number(verdict.delight) >= 6);
      return {...video, ai: {keep, safe: Boolean(verdict.safe), delight: Number(verdict.delight) || 0,
        channel: TV_CHANNELS.includes(verdict.channel) ? verdict.channel : video.suggested,
        place: tidy(verdict.place), intro: tidy(verdict.intro), reason: clean(verdict.reason).slice(0, 300)}};
    })
  };
}

export async function checkVideos(videos, {apiKey = process.env.ANTHROPIC_API_KEY, parallel = 4} = {}) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const batches = [];
  for (let index = 0; index < videos.length; index += BATCH_SIZE) batches.push(videos.slice(index, index + BATCH_SIZE));
  const out = [], errors = [], usage = {input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0};
  for (let index = 0; index < batches.length; index += parallel) {
    const results = await Promise.allSettled(batches.slice(index, index + parallel).map(batch => checkBatch(batch, apiKey)));
    results.forEach((result, offset) => {
      if (result.status === "fulfilled") {
        out.push(...result.value.videos);
        Object.keys(usage).forEach(key => { usage[key] += Number(result.value.usage?.[key]) || 0; });
      } else {
        errors.push(String(result.reason?.message || result.reason).slice(0, 300));
        out.push(...batches[index + offset].map(video => ({...video, ai: null})));
      }
    });
  }
  const cost = (usage.input_tokens + usage.cache_read_input_tokens * 0.1 + usage.cache_creation_input_tokens * 1.25 + usage.output_tokens * 5) / 1e6;
  return {videos: out, cost, errors};
}
