# Better Start Reader V4

Rage-free articles, videos and small joy breaks in a playful editorial wall.

## Vercel setup

The app works immediately with its built-in public sources. To share approved video sources and seven-day memory with Better Start Video, connect both Vercel projects to the same Upstash Redis database.

Add these Vercel environment variables to both projects:

- `YOUTUBE_API_KEY`
- `ADMIN_SECRET`
- `CRON_SECRET`

The Upstash integration adds its own connection variables automatically.

## Refresh rules

- Command-R requests a new unseen-first composition.
- The Reader replaces roughly 80% of the wall every two hours.
- A new calendar day forces a full edition reset.
- Videos and Joy Bench variants stay out for at least seven days in that browser.
- Saved stories remain available.
- A final browser-side URL and normalized-headline check prevents a story from
  appearing in more than one section, even if a cached or blended API response
  contains it twice.

## Safe update

This folder is a complete replacement build. Upload its **contents** to the
existing Reader GitHub repository, commit the change, and let Vercel create a
preview deployment first. The current production deployment remains available
until you explicitly promote the preview or merge to the production branch.
