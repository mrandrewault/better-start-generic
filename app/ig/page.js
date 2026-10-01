import { pantryDb } from "../../lib/pantry.js";

// LINK IN BIO: meanwhile.now/ig
// Mirrors the Instagram grid. Someone sees a post, taps the link in our bio,
// taps the same card here, and lands on the story. It builds itself from the
// social robot's log, so there is nothing to update by hand.
export const metadata = {title: "Meanwhile on Instagram", description: "Tap a card to read the story."};
export const revalidate = 300;

async function posts() {
  try {
    const {data} = await pantryDb().from("social_posts").select("story_id, card_line, url, source, created_at").eq("status", "drafted").order("created_at", {ascending: false}).limit(60);
    return data || [];
  } catch { return []; }
}

const css = `
.ig{min-height:100vh;background:#f7f4ec;color:#141414;font-family:"Space Grotesk","DM Sans",sans-serif;padding:28px 16px 60px}
.ig main{max-width:900px;margin:0 auto}
.ig header{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;margin-bottom:22px}
.ig .mark{font:700 44px/1 "Space Grotesk",sans-serif;letter-spacing:-.06em}
.ig .mark span:nth-child(4n+1){color:#2457b8}.ig .mark span:nth-child(4n+2){color:#e2492f}.ig .mark span:nth-child(4n+3){color:#1e6653}.ig .mark span:nth-child(4n){color:#c4421a}
.ig p{margin:0;font:500 15px/1.4 "DM Sans",sans-serif;color:#4a463e}
.ig .home{display:inline-block;margin-top:8px;border:2px solid #141414;border-radius:999px;padding:9px 18px;font:700 12px "DM Sans",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#141414;text-decoration:none}
.ig .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.ig .grid a{display:block;aspect-ratio:4/5;background:#e6e1d4;overflow:hidden}
.ig .grid img{width:100%;height:100%;object-fit:cover;display:block}
.ig .empty{text-align:center;padding:60px 0}
`;

export default async function InstagramLinks() {
  const list = await posts();
  return (
    <div className="ig">
      <style dangerouslySetInnerHTML={{__html: css}} />
      <main>
        <header>
          <div className="mark" aria-label="Meanwhile">{"Meanwhile,".split("").map((letter, index) => <span key={index}>{letter}</span>)}</div>
          <p>Good things are happening all over the world. Tap a card to read the story.</p>
          <a className="home" href="/">Open today&apos;s Meanwhile</a>
        </header>
        {list.length ? (
          <div className="grid">
            {list.map(post => (
              <a key={post.story_id} href={post.url} target="_blank" rel="noreferrer" aria-label={`${post.card_line} (via ${post.source})`}>
                <img src={`/api/social/card?id=${encodeURIComponent(post.story_id)}&size=feed&v=4`} alt={post.card_line || ""} loading="lazy" />
              </a>
            ))}
          </div>
        ) : <p className="empty">The first posts are on their way.</p>}
      </main>
    </div>
  );
}
