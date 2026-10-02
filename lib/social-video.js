import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import sharp from "sharp";
import { renderLayer, headlineModel, storyModel, endModel, SLIDE_SIZES } from "./social-card.js";
import { pantryDb } from "./pantry.js";

// THE MOVING CARD (TikTok)
// The same three slides as the Instagram swipe-through, but alive: the color
// bands slide in, the headline rises line by line, the story pushes up, and
// the end card wipes in. About 12 seconds, set to the Meanwhile sting (our own
// little signature tune, data/audio/meanwhile-sting.m4a). Its bells ring right
// on each scene change: 0s headline, 3.6s story, 8.1s where to read it.
//
// How: each piece of each slide is drawn once as a see-through picture, then
// ffmpeg moves and fades the pieces on a timeline and adds the music.
// The finished MP4 is kept in Supabase Storage (bucket "social-videos"), and
// Buffer fetches it from there.

const FPS = 30;
const LENGTH = 12;
const SCENE_STORY = 3.6, SCENE_END = 8.1;
export const VIDEO_BUCKET = "social-videos";
const VERSION = "v2";                         // change to re-render every video

// Where the ffmpeg program lives. On Vercel it ships inside the
// @ffmpeg-installer package; on a laptop it may already be installed.
let ffmpegReady = null;
function ffmpegPath() {
  if (ffmpegReady) return ffmpegReady;
  const candidates = [process.env.FFMPEG_PATH];
  try {
    const store = path.join(process.cwd(), "node_modules", ".pnpm");
    fs.readdirSync(store).filter(name => name.startsWith("@ffmpeg-installer+linux-x64")).forEach(name => candidates.push(path.join(store, name, "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg")));
  } catch {}
  candidates.push(path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg"), "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg");
  const found = candidates.find(file => file && fs.existsSync(file));
  if (!found) throw new Error("ffmpeg was not found.");
  try { fs.accessSync(found, fs.constants.X_OK); ffmpegReady = found; }
  catch {
    // Read-only and not runnable: copy it somewhere it can run.
    const copy = path.join(os.tmpdir(), "meanwhile-ffmpeg");
    if (!fs.existsSync(copy)) { fs.copyFileSync(found, copy); fs.chmodSync(copy, 0o755); }
    ffmpegReady = copy;
  }
  return ffmpegReady;
}

function run(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {stdio: ["ignore", "ignore", "pipe"]});
    let log = "";
    child.stderr.on("data", chunk => { log = (log + chunk).slice(-3000); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg stopped (${code}): ${log.slice(-600)}`)));
  });
}

// Little motion helpers, written as ffmpeg expressions.
const num = value => Number(value).toFixed(3);
const progress = (start, length) => `clip((t-${num(start)})/${num(length)},0,1)`;
const easeOut = (start, length) => `(1-pow(1-${progress(start, length)},3))`;
const hex = color => `0x${String(color).replace("#", "").slice(0, 6)}`;

// Cut a full-size see-through layer down to a strip, so ffmpeg has less to move.
async function strip(png, top, height, width, fullHeight) {
  const y = Math.max(0, Math.round(top)), h = Math.max(2, Math.min(fullHeight - y, Math.round(height)));
  return {png: await sharp(png).extract({left: 0, top: y, width, height: h}).png().toBuffer(), y};
}

// Builds the whole timeline: a list of pictures and solid color bands, each
// with when and how it moves.
async function plan(card) {
  const size = "tall";
  const {width: W, height: H} = SLIDE_SIZES[size];
  const full = {...card, size, slides: 3, video: true};
  const layer = (slide, only) => renderLayer(full, size, slide, only);
  const items = [];
  const hasStory = Boolean(String(card.story || "").trim());
  const SCENE_A_OFF = hasStory ? SCENE_STORY + 0.7 : SCENE_END + 0.8, SCENE_B_OFF = SCENE_END + 0.8;

  // SCENE 1: the headline. Bands slide in from the left, one after another,
  // then the wordmark, the headline lines (rising), and the credit line.
  const head = headlineModel(full, W, H);
  head.bands.forEach((band, index) => items.push({kind: "band", color: band.color, w: W, h: band.height, y: band.top,
    x: `-${W}*(1-${easeOut(0.02 + index * 0.08, 0.55)})`, until: SCENE_A_OFF}));
  const markArea = head.pad + head.wordmarkSize * 1.4;
  items.push({kind: "image", ...(await strip(await layer(1, "mark"), 0, markArea, W, H)), fadeAt: 0.45, fadeFor: 0.35, until: SCENE_A_OFF});
  for (const [index, row] of head.rows.entries()) {
    const start = 0.6 + index * 0.13;
    const piece = await strip(await layer(1, `row-${index}`), row.top - head.size * 0.12, head.lineHeight + head.size * 0.24, W, H);
    items.push({kind: "image", png: piece.png, y: `${piece.y}+${Math.round(head.size * 0.35)}*(1-${easeOut(start, 0.5)})`, fadeAt: start, fadeFor: 0.4, until: SCENE_A_OFF});
  }
  const lastBand = head.bands[head.bands.length - 1];
  items.push({kind: "image", ...(await strip(await layer(1, "foot"), lastBand.top, lastBand.height, W, H)), fadeAt: 1.4, fadeFor: 0.4, until: SCENE_A_OFF});

  // SCENE 2: the story pushes up from the bottom, then its sentences fade in.
  const story = storyModel(full, W, H);
  if (story.paragraphs.length) {
    items.push({kind: "image", png: await layer(2, "bg"), y: `${H}*(1-${easeOut(SCENE_STORY, 0.55)})`, from: SCENE_STORY, until: SCENE_B_OFF});
    for (const [index] of story.paragraphs.entries()) {
      const start = SCENE_STORY + 0.55 + index * 0.55;
      const piece = await strip(await layer(2, `para-${index}`), story.textTop, story.room, W, H);
      items.push({kind: "image", png: piece.png, y: `${piece.y}+40*(1-${easeOut(start, 0.6)})`, fadeAt: start, fadeFor: 0.5, from: start, until: SCENE_B_OFF});
    }
  }

  // SCENE 3: where to read it. Bands wipe in from the right, then the words.
  const end = endModel(full, W, H);
  end.bands.forEach((band, index) => items.push({kind: "band", color: band.color, w: W, h: band.height, y: band.top,
    x: `${W}*(1-${easeOut(SCENE_END + index * 0.08, 0.55)})`, from: SCENE_END}));
  items.push({kind: "image", ...(await strip(await layer(3, "mark"), 0, end.pad + end.wordmarkSize * 1.4, W, H)), fadeAt: SCENE_END + 0.5, fadeFor: 0.35, from: SCENE_END});
  for (const [index] of end.lines.entries()) {
    const band = end.bands[index], start = SCENE_END + 0.6 + index * 0.18;
    const piece = await strip(await layer(3, `line-${index}`), band.top, band.height, W, H);
    items.push({kind: "image", png: piece.png, y: `${piece.y}+60*(1-${easeOut(start, 0.5)})`, fadeAt: start, fadeFor: 0.4, from: start});
  }
  const footBand = end.bands[3];
  items.push({kind: "image", ...(await strip(await layer(3, "foot"), footBand.top, footBand.height, W, H)), fadeAt: SCENE_END + 1.3, fadeFor: 0.4, from: SCENE_END + 1.3});
  // The very first frame is the last palette color, so the first band visibly
  // sweeps in over it.
  return {W, H, items, background: head.bands[head.bands.length - 1].color};
}

// Make the MP4. Returns the video as a Buffer.
export async function renderVideo(card) {
  const {W, H, items, background} = await plan(card);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "meanwhile-video-"));
  try {
    const args = ["-hide_banner", "-loglevel", "error", "-y"];
    const filters = [`color=c=${hex(background)}:s=${W}x${H}:r=${FPS}:d=${LENGTH}[base]`];
    let inputs = 0, last = "base";
    items.forEach((item, index) => {
      let source;
      if (item.kind === "band") {
        filters.push(`color=c=${hex(item.color)}:s=${W}x${Math.max(2, Math.round(item.h))}:r=${FPS}:d=${LENGTH}[s${index}]`);
        source = `s${index}`;
      } else {
        const file = path.join(folder, `layer-${index}.png`);
        fs.writeFileSync(file, item.png);
        args.push("-loop", "1", "-framerate", String(FPS), "-t", String(LENGTH), "-i", file);
        const fade = item.fadeAt !== undefined ? `,fade=t=in:st=${num(item.fadeAt)}:d=${num(item.fadeFor)}:alpha=1` : "";
        filters.push(`[${inputs}:v]format=rgba${fade}[s${index}]`);
        inputs += 1;
        source = `s${index}`;
      }
      const from = item.from ?? 0, until = item.until ?? LENGTH;
      const x = item.x ?? 0, y = item.y ?? 0;
      filters.push(`[${last}][${source}]overlay=x='${x}':y='${y}':eval=frame:enable='between(t,${num(from)},${num(until)})'[v${index}]`);
      last = `v${index}`;
    });
    filters.push(`[${last}]format=yuv420p[out]`);
    const audio = path.join(process.cwd(), "data", "audio", "meanwhile-sting.m4a");
    const hasAudio = fs.existsSync(audio);
    if (hasAudio) args.push("-i", audio);
    const output = path.join(folder, "video.mp4");
    args.push("-filter_complex", filters.join(";"), "-map", "[out]");
    if (hasAudio) args.push("-map", `${inputs}:a`, "-c:a", "aac", "-b:a", "160k", "-af", `afade=t=out:st=${LENGTH - 0.6}:d=0.6`);
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(FPS), "-t", String(LENGTH), "-movflags", "+faststart", output);
    await run(ffmpegPath(), args);
    return fs.readFileSync(output);
  } finally {
    fs.rmSync(folder, {recursive: true, force: true});
  }
}

// The public address of a story's video in Supabase Storage.
export function videoUrl(id, db = pantryDb()) {
  return db.storage.from(VIDEO_BUCKET).getPublicUrl(`${id}-${VERSION}.mp4`).data.publicUrl;
}

// Make the video for one story (once), keep it in Storage, return its address.
export async function ensureVideo(id, card, {db = pantryDb(), fresh = false} = {}) {
  const name = `${id}-${VERSION}.mp4`;
  const url = videoUrl(id, db);
  if (!fresh) {
    const head = await fetch(url, {method: "HEAD", cache: "no-store"}).catch(() => null);
    if (head?.ok) return {url, made: false};
  }
  const mp4 = await renderVideo(card);
  let upload = await db.storage.from(VIDEO_BUCKET).upload(name, mp4, {contentType: "video/mp4", upsert: true, cacheControl: "31536000"});
  if (upload.error && /not found|bucket/i.test(upload.error.message)) {
    // First time: make the public bucket, then try again.
    await db.storage.createBucket(VIDEO_BUCKET, {public: true, fileSizeLimit: "50MB", allowedMimeTypes: ["video/mp4"]});
    upload = await db.storage.from(VIDEO_BUCKET).upload(name, mp4, {contentType: "video/mp4", upsert: true, cacheControl: "31536000"});
  }
  if (upload.error) throw new Error(`Could not save the video: ${upload.error.message}`);
  return {url, made: true, bytes: mp4.length};
}
