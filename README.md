# Meanwhile 09 — Personalized Vignelli Edition

This build keeps the complete generic Reader and four-step personalizer, while introducing the centered, overlapping Vignelli-inspired **Meanwhile** signature. Its three letter impressions are driven by the same four-color palette as the page, so every reload advances both the site and masthead together to a new coordinated palette.

The **Add More Stuff I Didn’t Ask For** control now remains available even after the initial surprise shelf is exhausted. It first reveals any unused surprises already loaded, then requests a fresh deduplicated batch from the feed instead of disappearing.

## Refresh and public-space safety

- Roughly 80% of the page refreshes every two hours.
- The complete edition is replaced after 24 hours and on a manual browser reload.
- Every surfaced item enters one edition-wide no-repeat ledger, matched by canonical URL, normalized title, video ID, and image URL. It cannot return to Good Stuff, Bright Spots, Good News With Consequence, You Didn’t Ask For This, tickers, video modules, or visual shelves.
- Saved stories remain available in the Saved shelf but are never recycled into the live edition.
- Public-space safety filtering excludes nudity and sexually explicit material, including artistic imagery, using story and media metadata.

This build includes the generic Reader and the four-step edition customizer while preserving the established feed, safety, visual-quality, global no-repeat memory, sharing and responsive-layout behavior.

This version makes photography and playable media a composition requirement rather than a ranking preference.

## Foundation carried into Meanwhile 01

- Adds a browser-side image quality gate: imagery must have a long edge of at least 900px, a short edge of at least 500px and at least 700,000 total pixels.
- A broken or undersized image is never enlarged into a feature frame.
- When possible, a rejected image causes the entire module to be replaced by a distinct, credited high-resolution visual-shelf feature; it is never used as unrelated decoration for the original story.
- If no truthful visual replacement is available, the story becomes a deliberately compact text module.
- YouTube previews now request their maximum-resolution artwork rather than the small default thumbnail.
- Expands the licensed visual reserve so the opening wall has replacements ready before a low-resolution source image reaches the screen.

## Carried forward from V10

- Checks up to 72 relevant source pages for Open Graph/Twitter images when RSS omits them.
- Redistributes available visuals so every ten-story cluster targets at least 50% honest imagery, video or interaction.
- Raises media frequency from one per three stories to one per two while media is available.
- Reserves large frames for visual/playable modules and keeps text-only stories compact.
- Never attaches an unrelated photograph to a story merely to decorate its card.
- Establishes the rule that edition-specific visual shelves must use licensed or explicitly displayable sources.
- Adds edition-aware, attributed Wikimedia Commons visual shelves when publisher imagery runs out (fashion, outdoors, sports, business, food, culture, science and general discovery each use distinct searches).

## Carried forward from V9

- Text-card colors are assigned by one page-wide palette sequence rather than repeating inside every layout cluster.
- No exact background swatch is reused in the loaded page; returning color families receive different hue, saturation and lightness values.
- Neighboring swatches come from deliberately separated color families, with automatic dark/light foreground contrast.
- Load More continues the same palette sequence, while the consequential and surprise sections use separate non-colliding ranges.

- A calmer four-pass taste interview: 12 broad opening choices, a tailored follow-up, subjects, then names and specifics.
- A new Philanthropy + Community lane emphasizes beneficiaries, measurable results and money put to genuine public use.
- Amazon and Jeff Bezos are blocked globally; MacKenzie Scott and constructive philanthropy remain welcome.
- The first 20 Good Stuff stories target at least 60% genuine editorial imagery; fashion-led editions require 70%. Logos, gradients and colored text cards never count as pictures.
- The first interview screen includes a direct **Fashion with a capital F** doorway.
- Fashion text modules rotate through a controlled spectrum of saturated, tinted, deep and neutral colors instead of defaulting to monochrome or pink.
- Weight-loss and body-anxiety filters now cover hyphenated wording and every visible page surface.

## Editorial identity foundation

- An editorial identity engine gives fashion, sports, business, outdoors, food, arts, science, books and making-focused editions their own publication logic.
- Fashion-led editions use a restrained cream, black and seasonal-accent system inspired by independent fashion magazines—not default pink.
- The fashion opening is image-first and reserves its lead frames for relevant fashion, portrait, runway, costume, book and culture imagery.
- Missing RSS artwork is recovered from article Open Graph metadata for a controlled set of high-value specialist stories.
- Fashion editions block BMI, weight-loss, body-fat and appearance-anxiety stories, plus distressing animal imagery, from their main composition.
- The women-writers bench now spans major fiction, international voices, essays, poetry, thrillers, speculative fiction and fantasy.
- New source packs cover outdoors, food and travel, arts and performance, and science and technology.
- Editorial-reference data documents the visual and editorial worlds guiding every identity, so those desks can deepen over time.

- Fashion-literate prompts covering Fashion Week, Bergdorf’s, Le Bon Marché, runway collecting and production design.
- Deep choices for fashion insiders, independent press, boutique labels, vintage runway, department stores and emerging designers.
- A broad women-writers shelf rather than a single author standing in for the category.
- New editorial inputs from The Gentlewoman, AnOther, System, Acne Paper, Vestoj, 1 Granary, SHOWstudio and other independent magazines.
- Strong fashion/women’s profiles use an 80/12/8 direct/adjacent/surprise opening composition.
- Unrelated generic videos cannot displace relevant fashion and women-centered stories in that mode.

- Text-only stories receive intentional category-colored editorial art direction instead of looking like missing-image placeholders.
- RSS image recovery now checks enclosures, media fields, lazy-loaded images and source sets before declaring a story text-only.
- Fashion coverage now reaches runway, couture, French and Italian houses, costume design, fashion photography, archives and 1990s style.
- A new Women, Culture + Modern Life desk covers women’s sports, WTA tennis, running, Pilates, wellness, beauty craft, writers, artists and leaders.
- New interview pathways include “I follow fashion beyond what’s in stores,” “I want more stories about remarkable women” and “I notice the costumes before the plot.”

- Eight specialist source packs:
  - The Sporting Life
  - Business, Ideas + Good Living
  - Fashion, Image + Style
  - Women, Culture + Modern Life
  - Books, History + Archives
  - Movement + Wellbeing
  - Making, Fixing + Growing
  - Cars, Boats + Beautiful Machines
- A person’s interview choices activate up to four relevant packs.
- Specialist stories are labeled quietly inside the wall.
- A compact strip beneath the masthead explains which editorial desks are contributing to the edition.
- New interview choices cover projects, gardening, boats, sailing and history; deeper choices cover yoga and boatbuilding.
- Generic Reader behavior is unchanged when no personal profile exists.
- All established safety, deduplication, source-spacing, refresh, global no-repeat memory, layout, mobile, Save, Share and Joy Bench rules remain active.

## Login-free deployment

1. Create a new GitHub repository named `meanwhile-reader` (or update the repository you already use for the generic/customizable Reader).
2. Upload the **contents** of this folder.
3. In Vercel choose **Add New → Project** and import that repository.
4. Leave the defaults unchanged and click **Deploy**.
5. Share the main production `vercel.app` address.

No login, database or environment variables are required for this test version. Each tester’s choices are stored privately in that browser.
