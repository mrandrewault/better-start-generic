"use client";
import {useEffect, useMemo, useState} from "react";
import {supabase} from "../../lib/supabase";
import {EDITION_PALETTES} from "../palettes.js";

// MAKE IT YOURS, one screen.
// Tap a big bubble and its smaller bubbles pop open right below it. Real
// stories from the pantry update as you tap. The bubbles float in once,
// then hold still, so they are easy to tap, so you can see your Meanwhile
// taking shape. The finished profile has the same shape as before, so the
// feed reads it exactly the same way.

const STATE_KEY = "meanwhileMakeItYoursV3";
const PROFILE_KEY = "betterStartPersonalProfileV1";

// line: the big bubble. name: the plain topic name the feed understands.
// topics: the pantry's own topic tags. kids: the smaller bubbles.
const PICKS = [
  {id: "music", line: "Music is usually playing", name: "Music", topics: ["music"], kids: ["Jazz", "Classical", "Rock", "Hip-hop", "Country + folk", "Electronic", "Soul + R&B", "Live music", "Global sounds"]},
  {id: "food", line: "I know a good place to eat", name: "Food", topics: ["food", "beverage"], kids: ["Restaurants", "Cooking at home", "Bakeries", "Coffee + tea", "Wine + cocktails", "World cuisines", "Food history"]},
  {id: "outside", line: "I’d rather be outside", name: "Nature + outdoors", topics: ["outdoors", "gardening"], kids: ["Hiking", "National parks", "Gardens", "Birds", "Oceans", "Camping"]},
  {id: "works", line: "I want to know how things work", name: "Science + technology", topics: ["tech", "thinking"], kids: ["Space", "Inventions", "Engineering", "Robots", "Clean energy", "Science"]},
  {id: "design", line: "Art and design are part of my life", name: "Art + design", topics: ["arts"], kids: ["Painting", "Architecture", "Photography", "Graphic design", "Museums", "Furniture", "Typography"]},
  {id: "screen", line: "I love a good movie", name: "Movies + TV", topics: ["entertainment"], kids: ["Classic film", "New movies", "Great TV", "Documentaries", "Animation", "Comedy"]},
  {id: "read", line: "I read for fun", name: "Books + ideas", topics: ["books", "history"], kids: ["Fiction", "History", "Poetry", "Comics", "Bookshops", "Biographies"]},
  {id: "team", line: "I follow a team", name: "Sports", topics: ["sports"], kids: ["Baseball", "Football", "Basketball", "Soccer", "Tennis", "Running", "Golf"]},
  {id: "travel", line: "I’m usually planning a trip", name: "Travel", topics: ["travel"], kids: ["Great cities", "Small towns", "Train journeys", "Hotels", "Islands", "Road trips"]},
  {id: "animals", line: "Animals make almost everything better", name: "Animals", topics: ["outdoors", "surprise"], kids: ["Dogs", "Cats", "Wildlife", "Birds", "Rescue stories", "Ocean life"]},
  {id: "making", line: "I like making or fixing things", name: "Making things", topics: ["crafts", "home"], kids: ["Woodworking", "Ceramics", "Repair", "Sewing", "Home projects", "Tools"]},
  {id: "style", line: "Fashion with a capital F", name: "Style + fashion", topics: ["fashion"], kids: ["Runway", "Designers", "Vintage", "Fashion photography", "Personal style", "Sneakers"]},
  {id: "money", line: "I keep up with business and money", name: "Business + money", topics: ["business"], kids: ["Founders", "Small businesses", "Clever companies", "Personal finance", "Markets"]},
  {id: "wheels", line: "Things with wheels (and sails)", name: "Cars, boats + transportation", topics: ["auto"], kids: ["Classic cars", "Car design", "Motorcycles", "Boats + sailing", "Trains", "Aviation"]},
  {id: "home", line: "Home is my happy place", name: "Home + garden", topics: ["home", "gardening"], kids: ["Interior design", "Small spaces", "Old houses", "Plants", "Organizing"]},
  {id: "people", line: "People doing good things", name: "Good people", topics: ["surprise", "thinking"], kids: ["Kindness", "Community projects", "Giving", "Teachers", "Neighbors"]},
  {id: "curious", line: "I’ll happily learn something new", name: "History + curiosities", topics: ["trivia", "history", "thinking", "surprise"], kids: ["History", "Did you know", "Archaeology", "Maps", "Language"]}
];
// Extra words to look for in headlines, when a bubble's own name is not enough.
const WORDS = {
  "Country + folk": ["country", "folk", "bluegrass"], "Soul + R&B": ["soul", "motown", "r b"], "Global sounds": ["afrobeat", "reggae", "cumbia", "world music"],
  "Cooking at home": ["recipe", "cooking", "cook"], "Coffee + tea": ["coffee", "tea", "cafe"], "Wine + cocktails": ["wine", "cocktail", "beer", "whisk"],
  "World cuisines": ["cuisine", "dish", "noodle", "taco", "curry"], "Food history": ["food history", "recipe from"], "Birds": ["bird", "owl", "eagle"],
  "Oceans": ["ocean", "sea", "reef", "coral"], "Robots": ["robot"], "Inventions": ["invent", "invention", "prototype"], "Clean energy": ["solar", "wind power", "battery", "clean energy"],
  "Science": ["scientist", "discover", "study"], "Space": ["space", "nasa", "telescope", "moon", "planet", "galaxy"], "Classic film": ["classic film", "restored", "hollywood"],
  "Great TV": ["series", "television", "tv"], "Fiction": ["novel", "fiction"], "Comics": ["comic", "graphic novel", "manga"], "Bookshops": ["bookshop", "bookstore"],
  "Biographies": ["biography", "memoir"], "Great cities": ["city", "paris", "tokyo", "london", "new york"], "Train journeys": ["train", "rail"], "Hotels": ["hotel", "inn", "resort"],
  "Islands": ["island"], "Road trips": ["road trip", "drive"], "Dogs": ["dog", "puppy"], "Cats": ["cat", "kitten"], "Wildlife": ["wildlife", "bear", "whale", "elephant", "wolf"],
  "Rescue stories": ["rescue", "rescued", "sanctuary"], "Ocean life": ["whale", "dolphin", "otter", "octopus", "seal"], "Repair": ["repair", "restore", "fix"],
  "Home projects": ["renovat", "diy", "makeover"], "Tools": ["tool", "workshop"], "Runway": ["runway", "fashion week", "couture"], "Designers": ["designer", "collection"],
  "Vintage": ["vintage", "archive"], "Personal style": ["style", "wardrobe"], "Founders": ["founder", "startup"], "Small businesses": ["small business", "shop", "family business"],
  "Clever companies": ["company", "brand"], "Personal finance": ["saving", "money", "budget"], "Car design": ["concept car", "car design"], "Classic cars": ["classic car", "vintage car"],
  "Boats + sailing": ["boat", "sail", "yacht"], "Trains": ["train", "railway"], "Aviation": ["plane", "aircraft", "flight", "aviation"], "Interior design": ["interior", "living room", "kitchen"],
  "Small spaces": ["small space", "tiny house", "studio apartment"], "Old houses": ["historic home", "old house", "farmhouse"], "Plants": ["plant", "houseplant"],
  "Kindness": ["kind", "kindness", "generous"], "Community projects": ["community", "neighborhood", "volunteer"], "Giving": ["donat", "gift", "charity", "philanthrop"],
  "Teachers": ["teacher", "school"], "Neighbors": ["neighbor"], "Did you know": ["did you know", "turns out", "secret"], "Maps": ["map"], "Language": ["language", "word"]
};
const wordsFor = label => WORDS[label] || [label.toLowerCase()];

// Colors: every big bubble gets its own Color Hunt palette, the same palettes
// as the logo and the Instagram cards.
const paletteFor = index => EDITION_PALETTES[(index * 7 + 3) % EDITION_PALETTES.length];
const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const inkOn = hex => (lum(hex) > 0.36 ? "#141414" : "#FFFDF7");
const strongest = palette => [...palette].sort((a, b) => Math.abs(lum(b) - 0.45) - Math.abs(lum(a) - 0.45)).reverse()[0];
const toggle = (list, value) => list.includes(value) ? list.filter(item => item !== value) : [...list, value];
const WORDMARK = EDITION_PALETTES.flat().filter(color => lum(color) < 0.3).filter((color, index) => index % 7 === 0).slice(0, 4);

export default function MakeItYoursOneScreen() {
  const [picks, setPicks] = useState([]);           // big bubble ids
  const [kids, setKids] = useState([]);             // small bubble labels, as "id:label"
  const [extras, setExtras] = useState([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Start from earlier choices, if there are any.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      if (saved) { setPicks(saved.picks || []); setKids(saved.kids || []); setExtras(saved.extras || []); setName(saved.name || ""); }
      else {
        const old = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
        if (old) {
          const names = [...(old.broadInterests || []), ...(old.openingChoices || [])];
          const fromOld = PICKS.filter(pick => names.includes(pick.name) || names.includes(pick.line)).map(pick => pick.id);
          setPicks(fromOld);
          setKids(PICKS.filter(pick => fromOld.includes(pick.id)).flatMap(pick => pick.kids.filter(kid => (old.specificInterests || []).includes(kid)).map(kid => `${pick.id}:${kid}`)));
          setExtras(old.anythingElse || []); setName(old.name || "");
        }
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(STATE_KEY, JSON.stringify({picks, kids, extras, name})); } catch {} }, [picks, kids, extras, name, loaded]);

  const chosen = PICKS.filter(pick => picks.includes(pick.id));
  const kidLabels = kids.map(value => value.split(":").slice(1).join(":"));

  // The live preview: real stories for these picks, a moment after each tap.
  useEffect(() => {
    const topics = [...new Set(chosen.flatMap(pick => pick.topics))];
    const terms = [
      ...kids.flatMap(value => { const label = value.split(":").slice(1).join(":"); return wordsFor(label).map(word => `${word}~${label}`); }),
      ...extras.map(word => `${word}~${word}`)
    ];
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/pantry/sample?topics=${encodeURIComponent(topics.join(","))}&terms=${encodeURIComponent(terms.join("|"))}`);
        const result = await response.json();
        setStories(result.stories || []);
      } catch { setStories([]); }
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [picks.join(","), kids.join(","), extras.join(",")]);

    const tapBig = pick => { setPicks(toggle(picks, pick.id)); if (picks.includes(pick.id)) setKids(kids.filter(value => !value.startsWith(`${pick.id}:`))); };
  const tapKid = (pick, label) => setKids(toggle(kids, `${pick.id}:${label}`));
  const addExtra = () => { const words = draft.split(",").map(value => value.trim()).filter(Boolean).filter(value => !extras.includes(value)); if (words.length) setExtras([...extras, ...words].slice(0, 20)); setDraft(""); };
  const reset = () => { if (confirm("Clear your picks and start over?")) { setPicks([]); setKids([]); setExtras([]); setName(""); try { localStorage.removeItem(STATE_KEY); } catch {} } };

  const topicName = useMemo(() => { const map = {}; chosen.forEach(pick => pick.topics.forEach(topic => { map[topic] = map[topic] || pick.name; })); return map; }, [picks.join(",")]);
  const count = picks.length + kids.length + extras.length;

  const open = async () => {
    const profile = {
      version: 6, name: name.trim(), title: name.trim() ? `${name.trim()}’s Edition` : "My Edition",
      openingChoices: chosen.map(pick => pick.line), broadInterests: chosen.map(pick => pick.name),
      specificInterests: kidLabels, details: [], granularInterests: [], anythingElse: extras,
      updatedAt: new Date().toISOString()
    };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
    try {
      if (supabase) { const {data: {user}} = await supabase.auth.getUser(); if (user) await supabase.from("profiles").upsert({user_id: user.id, display_name: profile.name || null, edition_name: profile.title, preferences: profile}); }
    } catch {}
    window.location.href = "/?personalized=true";
  };

  return (
    <main className="miy">
      <style>{CSS}</style>
      <header>
        <a href="/" className="mark" aria-label="Meanwhile home">{"Meanwhile,".split("").map((letter, index) => <span key={index} style={{color: WORDMARK[index % WORDMARK.length]}}>{letter}</span>)}</a>
        <button onClick={reset}>Start over</button>
      </header>
      <div className="layout">
        <section className="left">
          <p className="eyebrow">Make it yours · about 30 seconds</p>
          <h1>What makes your day better?</h1>
          <p className="lede">Tap anything that sounds like you. Tap again to go deeper. Your stories change as you go.</p>
          <div className="field">
            {PICKS.map((pick, index) => {
              const palette = paletteFor(index), on = picks.includes(pick.id), fill = strongest(palette);
              const size = pick.line.length > 30 ? "lg" : pick.line.length > 22 ? "md" : "sm";
              return [
                <button key={pick.id} type="button" className={`big ${size} ${on ? "on" : ""}`} aria-pressed={on}
                  style={{"--fill": fill, "--ink": inkOn(fill), "--edge": palette[2], "--soft": palette[0], "--delay": `${index * 45}ms`}}
                  onClick={() => tapBig(pick)}>
                  <span>{pick.line}</span><i>{on ? "✓" : "+"}</i>
                </button>,
                on && (
                  <div key={`${pick.id}-kids`} className="kids" style={{"--edge": palette[2]}}>
                    <small>Go deeper in {pick.name.toLowerCase()}</small>
                    <div>
                      {pick.kids.map((label, kidIndex) => {
                        const kidOn = kids.includes(`${pick.id}:${label}`), color = palette[kidIndex % palette.length];
                        return <button key={label} type="button" className={`kid ${kidOn ? "on" : ""}`} aria-pressed={kidOn}
                          style={{"--fill": color, "--ink": inkOn(color), "--edge": palette[2], animationDelay: `${kidIndex * 40}ms`}}
                          onClick={() => tapKid(pick, label)}>{label}</button>;
                      })}
                    </div>
                  </div>
                )
              ];
            })}
          </div>
          <div className="extras">
            <label htmlFor="extra">Anything else? <span>A band, a team, a hobby, a place.</span></label>
            <div className="extraRow">
              <input id="extra" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addExtra(); } }} placeholder="woodworking, Wes Anderson, the Mets" />
              <button type="button" onClick={addExtra}>Add</button>
            </div>
            {!!extras.length && <div className="chips">{extras.map(word => <button key={word} type="button" onClick={() => setExtras(extras.filter(item => item !== word))}>{word} <span>×</span></button>)}</div>}
          </div>
          <div className="finish">
            <label htmlFor="name">Name your edition <span>Optional</span></label>
            <input id="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your first name" />
            <button className="go" disabled={!picks.length} onClick={open}>{picks.length ? `Open ${name.trim() ? `${name.trim()}’s` : "my"} edition` : "Pick at least one"} <span>→</span></button>
            <p>Saved privately in this browser. Keep teaching it with More and Less while you read.</p>
          </div>
        </section>
        <aside className="right"><Preview stories={stories} loading={loading} chosen={chosen} topicName={topicName} /></aside>
      </div>
      <div className="dock">
        <Preview compact stories={stories} loading={loading} chosen={chosen} topicName={topicName} />
        <button className="go" disabled={!picks.length} onClick={open}>{picks.length ? `Open my edition · ${count}` : "Pick something you like"} <span>→</span></button>
      </div>
    </main>
  );
}

function Preview({compact, stories, loading, chosen, topicName}) {
  return (
    <div className={`preview ${compact ? "compact" : ""}`}>
      {!compact && <div className="previewHead"><span>Your Meanwhile, so far</span><b>{chosen.length ? "Updates as you tap" : "Today’s best, until you pick"}</b></div>}
      <div className="stories">
        {loading && !stories.length ? [0, 1, 2, 3].map(index => <div className="story ghost" key={index}><i style={{background: paletteFor(index)[1]}} /></div>) : stories.map((story, index) => {
          const palette = paletteFor(index + 2);
          const because = story.because ? `Because you like ${story.because}` : topicName[story.topic] ? `Because you like ${topicName[story.topic]}` : "Today’s best";
          return (
            <a className="story" key={story.id} href={story.url} target="_blank" rel="noreferrer">
              <div className="bands">{palette.map(color => <i key={color} style={{background: color}} />)}</div>
              {story.image && <img src={story.image} alt="" loading="lazy" />}
              <div className="storyBody"><em>{because}</em><b>{story.title}</b><small>{story.source}</small></div>
            </a>
          );
        })}
        {!loading && !stories.length && <p className="empty">Stories will show up here as you pick.</p>}
      </div>
    </div>
  );
}

const CSS = `
.miy{--paperx:#f6f1e6;max-width:1320px;margin:0 auto;padding:22px 28px 60px;color:#171713;font-family:"DM Sans",sans-serif}
.miy header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #171713;padding-bottom:14px}
.miy .mark{font:700 26px/1 "Space Grotesk",sans-serif;letter-spacing:-.06em}
.miy header button{border:0;background:none;font:700 10px "DM Sans";letter-spacing:.12em;text-transform:uppercase;text-decoration:underline;cursor:pointer}
.miy .layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:40px;margin-top:30px}
.miy .eyebrow{font:700 10px "DM Sans";letter-spacing:.16em;text-transform:uppercase;color:#d23d32;margin:0 0 10px}
.miy h1{font:800 clamp(44px,6.4vw,86px)/.86 "Fraunces",serif;letter-spacing:-.055em;margin:0;max-width:11ch}
.miy .lede{font:19px/1.35 "DM Serif Display",serif;color:#57534a;margin:16px 0 26px;max-width:34ch}
.miy .field{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.miy .big{position:relative;border:2px solid var(--fill);background:color-mix(in srgb,var(--fill) 14%,#fffdf7);color:#171713;border-radius:999px;padding:16px 46px 16px 22px;font:600 18px/1.1 "Space Grotesk",sans-serif;letter-spacing:-.02em;cursor:pointer;text-align:left;
  animation:miyFloatIn .6s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--delay);transition:background .18s,color .18s,transform .18s,box-shadow .18s;box-shadow:0 0 0 transparent}
.miy .big.lg{font-size:20px;padding:20px 50px 20px 26px}.miy .big.sm{font-size:16px}
.miy .big i{position:absolute;right:16px;top:50%;transform:translateY(-50%);font-style:normal;font-size:16px;opacity:.7}
.miy .big:hover{transform:translateY(-2px)}
.miy .big.on{background:var(--fill);color:var(--ink);border-color:var(--fill);box-shadow:5px 5px 0 #171713}
@keyframes miyFloatIn{from{opacity:0;transform:translateY(26px) scale(.85)}to{opacity:1;transform:none}}
.miy .kids{flex-basis:100%;border-left:4px solid var(--edge);padding:6px 0 10px 14px;margin:-2px 0 6px 10px}
.miy .kids small{display:block;font:700 9px "DM Sans";letter-spacing:.14em;text-transform:uppercase;color:#716d63;margin-bottom:8px}
.miy .kids>div{display:flex;flex-wrap:wrap;gap:8px}
.miy .kid{border:1.5px solid color-mix(in srgb,var(--edge) 70%,#171713);background:#fffdf7;border-radius:999px;padding:9px 15px;font:600 14px "DM Sans";cursor:pointer;animation:miyPop .28s cubic-bezier(.2,1.4,.4,1) both;transition:background .15s,color .15s}
.miy .kid.on{background:var(--fill);color:var(--ink);border-color:var(--fill)}
@keyframes miyPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
.miy .extras,.miy .finish{margin-top:34px;border-top:1px solid #d4cdbd;padding-top:20px;max-width:620px}
.miy label{display:block;font:600 18px "Space Grotesk";letter-spacing:-.02em;margin-bottom:10px}
.miy label span{font:14px "DM Serif Display";color:#716d63;letter-spacing:0;margin-left:6px}
.miy input{width:100%;border:1.5px solid #171713;background:#fffdf7;padding:13px 14px;font:16px "DM Sans";border-radius:0}
.miy .extraRow{display:flex;gap:8px}.miy .extraRow button{border:1.5px solid #171713;background:#171713;color:#fff;padding:0 18px;font:700 12px "DM Sans";cursor:pointer}
.miy .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.miy .chips button{border:0;background:#171713;color:#fffdf7;border-radius:999px;padding:7px 12px;font:600 13px "DM Sans";cursor:pointer}.miy .chips span{opacity:.6;margin-left:4px}
.miy .go{margin-top:16px;border:0;background:#171713;color:#fff;padding:16px 20px;font:700 12px "DM Sans";letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:5px 5px 0 #df7027;display:flex;gap:18px;align-items:center}
.miy .go:disabled{opacity:.35;cursor:default;box-shadow:none}
.miy .finish p{font:13px "DM Serif Display";color:#716d63;margin-top:14px}
.miy .right{position:sticky;top:20px;align-self:start;max-height:calc(100vh - 40px);overflow:auto}
.miy .previewHead{display:flex;flex-direction:column;gap:3px;border-top:5px solid #171713;padding-top:10px;margin-bottom:12px}
.miy .previewHead span{font:600 20px "Space Grotesk";letter-spacing:-.03em}.miy .previewHead b{font:700 9px "DM Sans";letter-spacing:.14em;text-transform:uppercase;color:#d23d32}
.miy .stories{display:flex;flex-direction:column;gap:12px}
.miy .story{display:block;background:#fffdf7;border:1px solid #d4cdbd;overflow:hidden}
.miy .story .bands{display:flex;height:6px}.miy .story .bands i{flex:1}
.miy .story img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.miy .storyBody{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px}
.miy .storyBody em{font:700 9px "DM Sans";font-style:normal;letter-spacing:.12em;text-transform:uppercase;color:#277448}
.miy .storyBody b{font:400 17px/1.15 "DM Serif Display",serif}.miy .storyBody small{font-size:11px;color:#716d63}
.miy .story.ghost{height:120px;display:flex;align-items:flex-end}.miy .story.ghost i{display:block;width:100%;height:6px}
.miy .empty{font:15px "DM Serif Display";color:#716d63}
.miy .dock{display:none}
@media(max-width:900px){
  .miy{padding:16px 16px 230px}
  .miy .layout{grid-template-columns:1fr;margin-top:22px}
  .miy .right{display:none}
  .miy .finish .go{display:none}
  .miy .big{font-size:16px;padding:13px 40px 13px 17px}.miy .big.lg{font-size:17px;padding:15px 42px 15px 19px}.miy .big.sm{font-size:15px}
  .miy .dock{display:block;position:fixed;left:0;right:0;bottom:0;background:#f6f1e6;border-top:2px solid #171713;padding:10px 12px calc(12px + env(safe-area-inset-bottom));z-index:20;box-shadow:0 -10px 30px #0001}
  .miy .dock .stories{flex-direction:row;overflow-x:auto;gap:8px;padding-bottom:4px;scroll-snap-type:x mandatory}
  .miy .dock .story{flex:0 0 220px;display:flex;scroll-snap-align:start}
  .miy .dock .story .bands{width:6px;height:auto;flex-direction:column}
  .miy .dock .story img{width:64px;height:auto;aspect-ratio:auto;flex:0 0 64px}
  .miy .dock .storyBody{padding:7px 9px;gap:2px;min-width:0}
  .miy .dock .storyBody b{font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .miy .dock .storyBody small{display:none}.miy .dock .storyBody em{font-size:8px}
  .miy .dock .story.ghost{height:74px}.miy .dock .empty{font-size:13px;margin:6px 0}
  .miy .dock .go{width:100%;justify-content:space-between;margin-top:10px;box-shadow:none}
}
@media(prefers-reduced-motion:reduce){.miy .big,.miy .kid{animation:none}}
`;
