import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { EDITION_PALETTES } from "../app/palettes.js";

// THE MEANWHILE PALETTE CARD
// One simple, bold design system. Every post is a Color Hunt style palette:
// four color bands, with the headline set big in the Meanwhile typeface
// (Space Grotesk, the same face as the logo) on top of them. The palettes are
// the same ones that color the Meanwhile logo on the site, so the website and
// the Instagram grid feel like one brand.
//   feed : 1080 x 1350 (Instagram, Threads)
//   tall : 1080 x 1920 (TikTok)
// Output is JPEG, because Instagram only accepts JPEG.

const SIZES = {feed: {width: 1080, height: 1350}, tall: {width: 1080, height: 1920}};
const INK = "#141414", PAPER = "#FFFDF7";

// Every palette, both ways up. That is 96 looks before any repeats.
export const PALETTES = EDITION_PALETTES.flatMap(colors => [colors, [...colors].reverse()]);
export const paletteAt = index => PALETTES[((index % PALETTES.length) + PALETTES.length) % PALETTES.length];

const fontFile = name => fs.readFileSync(path.join(process.cwd(), "data", "fonts", name));
let fonts = null;
const loadFonts = () => fonts || (fonts = [
  {name: "Space Grotesk", data: fontFile("space-grotesk-latin-700-normal.woff"), weight: 700, style: "normal"},
  {name: "DM Sans", data: fontFile("dm-sans-latin-700-normal.woff"), weight: 700, style: "normal"},
  {name: "DM Serif Display", data: fontFile("dm-serif-display-latin-400-normal.woff"), weight: 400, style: "normal"}
]);

// Color math: pick text colors people can actually read.
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const luminance = hex => rgb(hex).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Text color. A color from the palette itself looks designed, so try those
// first: it must read clearly on the top band (where most of the words sit)
// and stay legible on the bands below. Plain white or ink only as a backup.
function bestText(backgrounds, palette, minimum, lower = 1.7) {
  const [main, ...rest] = backgrounds;
  const ok = color => contrast(color, main) >= minimum && rest.every(background => contrast(color, background) >= lower);
  const score = color => contrast(color, main) + 0.4 * Math.min(...backgrounds.map(background => contrast(color, background)));
  const own = palette.filter(color => !backgrounds.includes(color) && ok(color)).sort((a, b) => score(b) - score(a))[0];
  if (own) return own;
  return [PAPER, INK].sort((a, b) => score(b) - score(a))[0];
}

// Letter widths of Space Grotesk Bold (share of the type size), measured from
// the font file, so we know exactly where each line will break.
const WIDTHS = {"A":0.634,"B":0.664,"C":0.644,"D":0.666,"E":0.554,"F":0.534,"G":0.662,"H":0.656,"I":0.264,"J":0.61,"K":0.626,"L":0.542,"M":0.882,"N":0.67,"O":0.676,"P":0.604,"Q":0.676,"R":0.632,"S":0.606,"T":0.588,"U":0.672,"V":0.618,"W":0.898,"X":0.644,"Y":0.624,"Z":0.576,"0":0.648,"1":0.452,"2":0.594,"3":0.608,"4":0.636,"5":0.6,"6":0.618,"7":0.554,"8":0.6,"9":0.618," ":0.254,".":0.298,",":0.294,":":0.298,";":0.298,"'":0.294,"\"":0.514,"?":0.578,"&":0.591,"-":0.432,"(":0.398,")":0.39,"/":0.388,"%":0.758,"$":0.606,"#":0.636,"+":0.62,"’":0.294,"‘":0.294,"“":0.514,"”":0.514};
const TRACKING = -0.02;
const textWidth = (text, size) => [...text].reduce((sum, char) => sum + ((WIDTHS[char] ?? 0.66) + TRACKING) * size, 0);
// Little words that should never be left hanging at the end of a line.
const WEAK = new Set(["A", "AN", "THE", "OF", "AT", "TO", "IN", "ON", "AND", "FOR", "WITH", "BY", "FROM", "ITS", "HIS", "HER", "THEIR", "IS", "ARE", "AS", "&"]);
function breakLines(text, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  // First, how many lines does it take at this size?
  let count = 0, current = "";
  for (const word of words) {
    if (current && textWidth(`${current} ${word}`, size) <= maxWidth) current = `${current} ${word}`;
    else { count += 1; current = word; }
  }
  // Then share the words out over that many lines as evenly as possible, so
  // no line is left with one lonely word, and no line ends on "a" or "the".
  const n = words.length, memo = new Map();
  const cost = (from, lines) => {
    const key = `${from}:${lines}`;
    if (memo.has(key)) return memo.get(key);
    let best = {score: Infinity, breaks: []};
    if (lines === 1) {
      const line = words.slice(from).join(" "), width = textWidth(line, size);
      if (width <= maxWidth) best = {score: (maxWidth - width) ** 2, breaks: []};
    } else {
      for (let end = from + 1; end <= n - lines + 1; end += 1) {
        const line = words.slice(from, end).join(" "), width = textWidth(line, size);
        if (width > maxWidth) break;
        const rest = cost(end, lines - 1);
        const penalty = ["A", "AN", "THE"].includes(words[end - 1]) ? maxWidth ** 2 : 0;
        const score = (maxWidth - width) ** 2 + penalty + rest.score;
        if (score < best.score) best = {score, breaks: [end, ...rest.breaks]};
      }
    }
    memo.set(key, best);
    return best;
  };
  const plan = cost(0, Math.max(1, count));
  if (!Number.isFinite(plan.score)) return words.length ? [words.join(" ")] : [];
  const lines = [];
  let start = 0;
  for (const end of [...plan.breaks, n]) { lines.push(words.slice(start, end).join(" ")); start = end; }
  return lines;
}
// True when a line still ends on a little word, or is only a little word.
const ARTICLES = new Set(["A", "AN", "THE"]);
const awkward = lines => lines.slice(0, -1).some(line => ARTICLES.has(line.split(" ").pop())) || (lines.length > 1 && lines.some(line => line.length <= 2));
// Share the lines out over the first three bands, top band heaviest,
// e.g. 5 lines become 2 + 2 + 1.
function shareLines(count) {
  const shares = [0, 0, 0];
  for (let index = 0; index < count; index += 1) shares[[0, 1, 2, 0, 1, 2, 0, 1, 2][index] ?? 0] += 1;
  return shares.sort((a, b) => b - a);
}

// THE LAYOUT. The type sets the bands: every line of the headline sits fully
// inside one color band, never across two, like a stack of labeled swatches.
function layout(text, width, height, maxSize) {
  const pad = Math.round(width * 0.067);
  const wordmarkSize = Math.round(width * 0.062);
  const topArea = pad + wordmarkSize * 1.5;           // wordmark space in the top band
  const footMin = Math.round(height * 0.12);          // the bottom band, for the credits
  const room = width - pad * 2;
  for (let size = maxSize; size >= 50; size -= 2) {
    const lines = breakLines(text, size, room);
    if (lines.some(line => textWidth(line, size) > room) || lines.length > 7) continue;
    // Avoid lines that end on "A" or "THE", or a lonely little word on its own.
    if (size > 64 && awkward(lines)) continue;
    const lineHeight = Math.round(size * 1.02);
    const shares = shareLines(lines.length);
    const used = shares.filter(Boolean).length;
    const textHeight = lines.length * lineHeight;
    const breathing = Math.round(size * 0.22);         // space above and below the words in each band
    const emptyBand = Math.round(height * 0.09);       // a band with no words still shows its color
    const needed = topArea + textHeight + breathing * 2 * used + emptyBand * (3 - used) + footMin;
    if (needed > height) continue;
    // Spread any spare room evenly into the text bands, so they stay generous.
    const spare = height - needed;
    const extra = Math.floor(spare * 0.6 / used);
    const bands = shares.map((count, index) => count ? count * lineHeight + (breathing + Math.floor(extra / 2)) * 2 + (index === 0 ? topArea : 0) : emptyBand);
    const footer = height - bands.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    const rows = [];
    shares.forEach((count, index) => {
      if (!count) return;
      const top = bands.slice(0, index).reduce((sum, value) => sum + value, 0) + (index === 0 ? topArea : 0);
      const inner = bands[index] - (index === 0 ? topArea : 0);
      const start = top + Math.round((inner - count * lineHeight) / 2);
      for (let line = 0; line < count; line += 1) rows.push({text: lines[cursor++], top: start + line * lineHeight, band: index});
    });
    return {size, lineHeight, pad, wordmarkSize, rows, bands: [...bands, footer], used};
  }
  return null;
}

// THE MODELS. Pure geometry and colors for each slide, shared by the still
// cards and the animated TikTok video (social-video.js), so both always match.
export function headlineModel(card, width, height) {
  const palette = card.palette || paletteAt(0);
  const text = String(card.line || "").toUpperCase();
  const plan = layout(text, width, height, card.size === "tall" ? 220 : 180);
  const {size, lineHeight, pad, wordmarkSize, rows, bands, used} = plan;
  // Every band gets its own text color, picked from the palette so it pops
  // against that band. Neighboring bands try not to repeat a color, so the
  // headline changes color as it steps down the card.
  const bandText = [];
  palette.slice(0, used).forEach((band, index) => {
    const options = palette.filter(color => color !== band && contrast(color, band) >= 3).sort((a, b) => contrast(b, band) - contrast(a, band));
    const fresh = options.find(color => color !== bandText[index - 1]);
    bandText.push(fresh || options[0] || bestText([band], palette, 3.2));
  });
  const colorFor = band => bandText[band] || bestText([palette[band]], palette, 3.2);
  let top = 0;
  const bandBoxes = bands.map((bandHeight, index) => { const box = {top, height: bandHeight, color: palette[index]}; top += bandHeight; return box; });
  // The wordmark: letters in the palette's colors, like the logo on the site,
  // but only colors that read well on the top band.
  const markColors = palette.filter(color => contrast(color, palette[0]) >= 2.6);
  return {
    palette, size, lineHeight, pad, wordmarkSize,
    rows: rows.map(row => ({...row, color: colorFor(row.band)})),
    bands: bandBoxes,
    markLetters: markColors.length >= 2 ? markColors : [colorFor(0)],
    footColor: bestText([palette[palette.length - 1]], palette, 3.4),
    footLeft: card.source ? `via ${card.source}` : "good things, all over",
    footRight: card.slides && !card.video ? `1 / ${card.slides}  ·  swipe for more` : "meanwhile.now"
  };
}

// The end slide says where to read the story. Instagram has the link in the
// bio. TikTok (the tall size) has no link at all yet, so it names the site.
export function endModel(card, width, height) {
  const palette = card.palette || paletteAt(0);
  const pad = Math.round(width * 0.067), wordmarkSize = Math.round(width * 0.062);
  const tall = card.size === "tall";
  const lines = tall ? ["READ THE", "FULL STORY AT", "MEANWHILE.NOW"] : ["READ THE", "WHOLE STORY", "LINK IN BIO"];
  const top = pad + wordmarkSize * 1.4;                // room for the wordmark
  const band = Math.round((height - Math.round(height * 0.12) - top) / 3);
  const heights = [band + top, band, band, height - band * 3 - top];
  let size = tall ? 150 : 132;
  while (size > 60 && Math.max(...lines.map(line => textWidth(line, size))) > width - pad * 2) size -= 2;
  const colorOn = background => palette.filter(color => color !== background && contrast(color, background) >= 3).sort((a, b) => contrast(b, background) - contrast(a, background))[0] || bestText([background], palette, 3.2);
  let y = 0;
  const bands = heights.map((bandHeight, index) => { const box = {top: y, height: bandHeight, color: palette[index], text: colorOn(palette[index])}; y += bandHeight; return box; });
  return {palette, pad, wordmarkSize, lines, top, size, bands, footColor: bestText([palette[3]], palette, 3.4),
    footLeft: tall ? "good things, all over" : "meanwhile.now", footRight: card.video ? "" : `${card.slides || 3} / ${card.slides || 3}`};
}

export function storyModel(card, width, height) {
  const palette = card.palette || paletteAt(0);
  const pad = Math.round(width * 0.067), wordmarkSize = Math.round(width * 0.062);
  const field = palette[0];
  const paragraphs = String(card.story || "").trim().split(/\n+/).filter(Boolean);
  const stripe = Math.round(height * 0.045), footer = Math.round(height * 0.1);
  const room = height - pad - wordmarkSize * 2 - stripe * 2 - footer - pad;
  // DM Serif Display is narrow; about 0.47 of the size per letter on average.
  let size = 96;
  for (; size > 40; size -= 2) {
    const perLine = (width - pad * 2) / (size * 0.47);
    let lines = 0;
    paragraphs.forEach(paragraph => { lines += Math.max(1, Math.ceil(paragraph.length / perLine)) + 0.4; });
    if (lines * size * 1.14 <= room * 0.9) break;
  }
  return {palette, pad, wordmarkSize, field, ink: bestText([field], palette, 4.5), paragraphs, stripe, footer, room, size,
    textTop: Math.round(pad + wordmarkSize * 1.8), footColor: bestText([palette[3]], palette, 3.4),
    footLeft: card.source ? `via ${card.source}` : "good things, all over", footRight: card.video ? "meanwhile.now" : `2 / ${card.slides || 3}`};
}

// card.video: the moving TikTok version, which has no slide numbers.
// `only` draws a single piece of a slide on a see-through background (the
// video animates the pieces one by one). Without it, the whole slide.
const showing = only => key => !only || only === key;

function PaletteCard({card, width, height, only = null}) {
  const model = headlineModel(card, width, height);
  const {size, lineHeight, pad, wordmarkSize, rows, bands, markLetters, footColor} = model;
  const show = showing(only);
  return (
    <div style={{width, height, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Space Grotesk"}}>
      {bands.map((band, index) => <div key={index} style={{display: "flex", width, height: band.height, background: show("bands") ? band.color : "transparent"}} />)}
      {show("mark") && <div style={{position: "absolute", top: pad, left: pad, display: "flex", fontSize: wordmarkSize, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 1}}>
        {"Meanwhile,".split("").map((letter, index) => <div key={index} style={{display: "flex", color: markLetters[index % markLetters.length]}}>{letter}</div>)}
      </div>}
      {rows.map((row, index) => show(`row-${index}`) && (
        <div key={index} style={{position: "absolute", top: row.top, left: pad, height: lineHeight, display: "flex", alignItems: "center", whiteSpace: "nowrap", color: row.color, fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: `${TRACKING}em`}}>{row.text}</div>
      ))}
      {show("foot") && <div style={{position: "absolute", left: pad, right: pad, bottom: Math.round(bands[bands.length - 1].height / 2 - width * 0.016), display: "flex", justifyContent: "space-between", color: footColor, fontFamily: "DM Sans", fontWeight: 700, fontSize: Math.round(width * 0.027), letterSpacing: "0.1em", textTransform: "uppercase"}}>
        <div style={{display: "flex"}}>{model.footLeft}</div>
        <div style={{display: "flex"}}>{model.footRight}</div>
      </div>}
    </div>
  );
}

// The little wordmark, shared by every slide.
function Wordmark({palette, background, pad, size, fallback}) {
  const markColors = palette.filter(color => contrast(color, background) >= 2.6);
  const letters = markColors.length >= 2 ? markColors : [fallback];
  return (
    <div style={{position: "absolute", top: pad, left: pad, display: "flex", fontSize: size, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 1, fontFamily: "Space Grotesk"}}>
      {"Meanwhile,".split("").map((letter, index) => <div key={index} style={{display: "flex", color: letters[index % letters.length]}}>{letter}</div>)}
    </div>
  );
}

// SLIDE 2: the story in a few sentences. One big color field (the palette's
// first color) with the words in an editorial serif, and the rest of the
// palette as thin bands along the bottom.
// only="bg" is everything but the words; only="para-N" is one paragraph.
function StorySlide({card, width, height, only = null}) {
  const model = storyModel(card, width, height);
  const {palette, pad, wordmarkSize, field, ink, paragraphs, stripe, footer, room, size, textTop, footColor} = model;
  const show = showing(only), background = show("bg");
  return (
    <div style={{width, height, display: "flex", flexDirection: "column", position: "relative", fontFamily: "DM Serif Display", background: background ? field : "transparent"}}>
      {background && <Wordmark palette={palette} background={field} pad={pad} size={wordmarkSize} fallback={ink} />}
      <div style={{position: "absolute", top: textTop, left: pad, right: pad, height: room, display: "flex", flexDirection: "column", justifyContent: "center", fontSize: size, lineHeight: 1.14, letterSpacing: "-0.01em"}}>
        {paragraphs.map((paragraph, index) => <div key={index} style={{display: "flex", marginBottom: size * 0.4, color: !only || only === `para-${index}` ? ink : "transparent"}}>{paragraph}</div>)}
      </div>
      {background && <div style={{position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", height: stripe, background: palette[1]}} />
        <div style={{display: "flex", height: stripe, background: palette[2]}} />
        <div style={{display: "flex", height: footer, background: palette[3], alignItems: "center", justifyContent: "space-between", padding: `0 ${pad}px`, color: footColor, fontFamily: "DM Sans", fontWeight: 700, fontSize: Math.round(width * 0.027), letterSpacing: "0.1em", textTransform: "uppercase"}}>
          <div style={{display: "flex"}}>{model.footLeft}</div>
          <div style={{display: "flex"}}>{model.footRight}</div>
        </div>
      </div>}
    </div>
  );
}

// SLIDE 3: where to read it. The palette bands again, one line per band.
function EndSlide({card, width, height, only = null}) {
  const model = endModel(card, width, height);
  const {palette, pad, wordmarkSize, lines, top, size, bands, footColor} = model;
  const show = showing(only);
  return (
    <div style={{width, height, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Space Grotesk"}}>
      {bands.map((band, index) => (
        <div key={index} style={{display: "flex", width, height: band.height, background: show("bands") ? band.color : "transparent", alignItems: "center", padding: `0 ${pad}px`, paddingTop: index === 0 ? top : 0}}>
          {index < 3 ? (show(`line-${index}`) ? <div style={{display: "flex", color: band.text, fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: `${TRACKING}em`, whiteSpace: "nowrap"}}>{lines[index]}</div> : null) : show("foot") ? (
            <div style={{display: "flex", width: "100%", justifyContent: "space-between", color: footColor, fontFamily: "DM Sans", fontWeight: 700, fontSize: Math.round(width * 0.03), letterSpacing: "0.1em", textTransform: "uppercase"}}>
              <div style={{display: "flex"}}>{model.footLeft}</div>
              <div style={{display: "flex"}}>{model.footRight}</div>
            </div>
          ) : null}
        </div>
      ))}
      {show("mark") && <Wordmark palette={palette} background={palette[0]} pad={pad} size={wordmarkSize} fallback={bands[0].text} />}
    </div>
  );
}

export const SLIDE_SIZES = SIZES;

// One piece of a slide as a see-through PNG, at full size.
export async function renderLayer(card, size, slide, only) {
  const {width, height} = SIZES[size] || SIZES.feed;
  const props = {card: {...card, size}, width, height, only};
  const element = slide === 2 ? <StorySlide {...props} /> : slide === 3 ? <EndSlide {...props} /> : <PaletteCard {...props} />;
  const image = new ImageResponse(element, {width, height, fonts: loadFonts()});
  return Buffer.from(await image.arrayBuffer());
}

// slide 1 = headline, 2 = the story, 3 = where to read it.
export async function renderCard(card, size = "feed", slide = 1) {
  const {width, height} = SIZES[size] || SIZES.feed;
  const props = {card: {...card, size}, width, height};
  const element = slide === 2 && card.story ? <StorySlide {...props} /> : slide === 3 ? <EndSlide {...props} /> : <PaletteCard {...props} />;
  const image = new ImageResponse(element, {width, height, fonts: loadFonts()});
  const png = Buffer.from(await image.arrayBuffer());
  return sharp(png).jpeg({quality: 92, mozjpeg: true}).toBuffer();
}
