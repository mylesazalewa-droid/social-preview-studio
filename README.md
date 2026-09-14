# Social Preview Studio

A native macOS app for previewing an image across every social placement, with
the caption shown the way each platform actually truncates it — then exporting
mockups to send to the team for feedback.

## Layout

A left rail: three view buttons on top, then six colored **tool buttons**
(Images, Caption, Hashtags, Brand, Templates, Backup). Click a tool button and its
panel slides out over the canvas with a colored header; click it again, press
Escape, or hit × to close. Only one panel is open at a time.

**Light / dark appearance** — the sun/moon button by the app name (top of the
sidebar) flips the whole app between a dark and a light theme; the choice is
remembered. This is the app's *own* chrome — separate from the **Light / Dark**
preview toggle in the top bar, which only changes how the mock platform UI looks.

**Note on "on-device AI":** Chrome ships a built-in on-device model, but it only
works inside Google Chrome itself — not in an app like this one. So the writing
tools use a (free) Gemini key. Caption health still needs nothing.

## AI assist

The **AI assist** panel (sidebar) and small ✨ buttons around the app help you
write and check posts.

- **Caption health** (Caption panel) always runs — offline, no key, no setup. It
  checks reading level, whether your call-to-action survives the "… more" fold,
  emoji noise, ALL-CAPS / exclamation tone, a missing next step, insider church
  jargon a newcomer won't know, and **scripture references** (flags "Philipians",
  wrong chapter numbers, impossible verse numbers).
- **The writing tools** (rewrite, variants, alt text, sermon packs, …) need a
  **Google Gemini key** — genuinely free, no credit card, about a minute, and one
  key covers the whole team. In the **AI assist** panel, click **Get a free key**
  (opens Google AI Studio → sign in → *Create API key* → copy), paste it, hit
  **Save & test**. It's stored encrypted on this Mac and requests go straight from
  the app to Google, never through anyone else.
- With the key connected you get: **Rewrite** (shorter / warmer / plainer / punchier /
  less hype), **3 variants** (different angles), **Fix the hook**, **Tone check**,
  **Per platform** (adapt the caption for each placement), **Translate** (with a
  back-translation sanity check), **Suggest hashtags**, **Write alt text** from the
  picture, **Suggest a verse** for the theme, **turn review feedback into a punch
  list**, and **Sermon → post pack** (paste notes, get a series name, key verses,
  pull-quotes and a week of posts).
- Every suggestion opens in a side panel with **Use** / **Copy** — nothing is
  changed until you choose it.

- **Compose** — the editor. **Focus** shows one large preview with a platform
  switcher (click / arrow keys / ‹ › to move between placements); **Board** shows
  every placement as a grid for export. Toggle in the top bar.
- **Board** — jumps straight to the grid.
- **Calendar** — **Month / Week / List** views of everything you've **Saved**.
  Click a post to reopen it; click a day to see that day's posts, set each post's
  status, paste its live URL, duplicate or delete it, or start a new one.
  Drag a post between days to reschedule it. The **Search posts** box (List view)
  filters by title or caption.

The **Brand** panel (sidebar) holds brand kits — display name, handle, avatar,
link URL and feedback recipients, saved as named sets you switch between with the
**Brand kit** dropdown (**＋ New / Duplicate / Delete**). The **Placements**
button chooses which placements appear.

## Saving & the calendar

- **Save** (top bar) stores the current post — images, captions, hashtags, first
  comment, brand, layout — under a title and a date, kept locally on your machine.
- Saved posts appear on their date in **Calendar**. Open one to load it back into
  Compose; "Save" then updates it, or "Save as new" branches it.
- Each post carries a **status** (Draft / Ready / Posted) and an optional **live
  URL** — set both from the day panel. Status shows as a colored dot on the
  calendar chip.
- **Duplicate** or **delete** a post from the day panel. Deletes go to a trash
  and can be undone from the toast.

## Backup

Everything lives in this Mac's local storage only. Use **Backup → Export backup**
(sidebar) to write a `.json` of every setting, post, and brand; **Restore** reads
one back. Keep a copy somewhere safe.

## Hashtags & first comment

- **Hashtag presets** — save any block of hashtags as a named preset; apply or
  delete them from the list. The preset matching your current hashtags is marked
  "in use". Hashtags are appended to the caption preview on IG, TikTok, LinkedIn
  and Facebook.
- **First comment** — the text posted as the first comment on Instagram /
  LinkedIn, shown under those cards.

## Review flow

- **Review file** (top bar) builds one self-contained `.html`. Send it to the team.
- The reviewer, in any browser: marks each placement **Approve / Needs work**,
  clicks the image to drop **numbered pins** with notes, adds an overall note per
  card, types their name. A running summary sits at the top.
- They click **Save as PDF** — the page prints one placement per page with the
  image, pins, and every comment laid out — and email that PDF back. No account,
  no server, nothing uploaded. (This replaced the flaky in-browser "email" buttons.)
- Also on the page: **Copy summary text** (plain text) and **Save data file (.json)**.
- The `.json` can be pulled back in via **Calendar → open the day → Import review
  feedback…**: it attaches to the post with a summary (`2 reviews · 6 approved · 1
  needs work`), every note and pin per reviewer, a one-tap "Set to Draft" when a
  Ready/Posted post got "needs work", and a review-count badge on the calendar chip.

## What it does

- **Drop in one or more images** (PNG / JPG / WebP). Add several for a
  **carousel** — the slide strip reorders by drag, each slide gets its own
  crop-focus point. Global cover / letterbox toggle.
- **Write one caption**; every card updates live with platform-correct
  truncation ("… more", "See more", "…see more") and character counters
  (X's 280 cap, YouTube's 100, etc.).
- **Set the account** name, handle/subtitle and avatar once.
- **Toggle placements** on/off. Included:
  Instagram Feed (1:1 / 4:5), Story, Reel · TikTok · YouTube Shorts ·
  YouTube Thumbnail (16:9) · X · Facebook Feed · LinkedIn Feed.
- **Carousels** render per platform: Instagram / LinkedIn / TikTok as a
  swipe with dots + "n/N", X as the 2–4 image mosaic, Facebook as a collage
  with "+N", Stories as progress segments. Non-carousel placements show the
  slide you're previewing.
- **Per-placement captions**: the dropdown above the caption box switches the
  editor between the master caption and a custom one for any single placement.
  Cards using a custom caption show a "custom text" badge; a "Reset to master"
  button clears it.
- **Clear all captions** (Caption panel) wipes the master caption and every
  per-placement override in one go, with an Undo.
- **Expandable captions**: click "… more" / "See more" on any card to expand the
  full caption in place, "show less" to collapse.
- **Preview toggles** (top bar, in Focus *and* Board):
  - **Mobile / Desktop** — the chrome and caption cut-off. Desktop uses wider
    columns and each platform's longer *web* cut-off (Facebook shows ~480 chars on
    the web vs ~250 in the app, etc.).
  - **Mock** — a separate on/off toggle. When on, Focus mode draws the preview
    inside an **iPhone** (Mobile) or a **MacBook** (Desktop). The device is a
    fixed size — flipping placements or toggling the mock never resizes it; the
    content adapts (feeds scroll inside, full-screen formats fill the screen).
    Turn it off for the bare card.
  - Board view keeps consistent card sizes in both Mobile and Desktop (only the
    caption cut-off changes there).
  - **Light / Dark** — flips every mock's chrome between light and dark mode to
    check text-on-image contrast both ways. Carries into exports and the review file.
  - **In-feed** — drops a faded "other post" above and below each feed card (and a
    YouTube results row above/below thumbnails) so you can judge the first caption
    line and the crop mid-scroll. Never included in exports.
  - **Safe areas** — the zones each platform's own UI covers.
- The **Size** (aspect) control for the focused placement sits in the bar under the
  platform switcher, next to "Customize description".
- **Caption cut-off meter** under the box: a bar per enabled platform showing
  where your caption gets truncated ("cut · 125") or exceeds a hard cap
  ("over by 83"), green / amber / red.
- **Safe-area overlays** (View panel): marks the zones where each platform's
  on-screen buttons and captions cover the image. Hidden in every export.
- **⌘V** pastes image(s) from the clipboard. **←/→** flip carousel slides.
- **Resizable sidebar** — drag its right edge; double-click to reset. The window
  remembers its own size and position between launches.
- Brand, platform toggles, ratios, fit, the safe-area setting, sidebar width,
  **and the caption text (master + per-placement)** persist between launches.
- **Export**
  - *Review file* → one self-contained `.html` for the team: every placement,
    a comment box and Approve / Needs-work toggle per card. The bottom panel
    shows the collected feedback live, with **Download as image · Copy · Open in
    Gmail · Email (mail app)**. Gmail carries the full feedback inline; the
    others copy it to the clipboard so nothing is lost to mail-client body
    limits. Recipients come from the brand kit (comma-separated). No server, no
    upload — opens in any browser.
  - *Ready pack* → asks for a folder name, then writes a folder for whoever posts
    on Sunday: one sub-folder per placement with the image at that platform's exact
    production size (1080×1350, 1280×720, …) — the format-specific graphic if one is
    set, otherwise the master cropped to spec — plus `caption.txt`, `hashtags.txt`,
    `first-comment.txt`, `alt-text.txt`, and a top-level `00-POSTING-GUIDE.txt`.
    Carousels get one numbered image per slide.
  - *Mockup PNGs* → a timestamped folder of the preview mockups, one per placement
    (carousel placements get one PNG per slide).
  - *Board · PNG* / *· PDF* → a single sheet of every placement.
  - *Publish for review…* → instantly publishes every enabled placement to a
    shareable review link (`yourapp.vercel.app/r/…`) and copies it to your
    clipboard — no export step. Send the link to your team; they leave
    comments and an Approve / Needs-work verdict right on the page, no login.
    Social Preview Studio checks for new comments in the background and pops
    up a notification when someone replies, and the day panel for that post
    shows the running comment thread. No exporting an HTML file and emailing
    it back and forth.
  - *Send to scheduler* → a folder with `content-calendar.csv` (one row per saved
    post per channel — date, time, channel, caption with hashtags already appended,
    first comment, link, status — for bulk import into Buffer / Later / Publer /
    Metricool / Hootsuite) and `content-calendar.ics` (double-click to drop every
    post onto Apple / Google / Outlook calendar as an all-day event).

## Templates

The **Templates** panel (sidebar) saves the current setup — caption skeleton,
hashtags, first comment, brand, which placements are on, ratios and fit — as a
named template, *without* the photo. Use `{{blank}}` markers in the caption for
the parts you rewrite each time. **Apply** stamps a template onto whatever you're
working on, keeping the image you've already dropped in. Templates ride along in
the Backup file.

## Format-specific images

The Images panel has a **Format-specific images** section listing every placement.
Upload a purpose-made graphic there (e.g. a real 9:16 Story design) and it
replaces the master image for that placement everywhere — preview, board, review
file, and the Ready pack (exported at that platform's exact size). "×" puts the
placement back on the master image.

## Alt text

Each image has an **alt text** field in the Images panel (a small amber dot on a
slide thumbnail means it's still empty). Alt text shows in the review file and is
written into the Ready pack.

Video preview is not in this version (images only, by design).

## Run it in development

```bash
npm install
npm start
```

## Build the Mac app

```bash
npm run dist       # -> dist/Social Preview Studio-1.0.0-arm64.dmg
```

Open the `.dmg` and drag the app to Applications. The build is unsigned, so the
first launch needs right-click → Open (or *System Settings → Privacy & Security
→ Open Anyway*).

For an Intel Mac, add `"x64"` to `build.mac.target[].arch` in `package.json`.

## Project layout

| Path | Purpose |
|------|---------|
| `main.js` | Electron main process + save-file / save-folder dialogs |
| `preload.js` | Bridges the export IPC to the renderer |
| `renderer/platforms.js` | Every platform's ratios + caption rules — edit here to tune |
| `renderer/app.js` | UI, live rendering, html-to-image / jsPDF export |
| `renderer/styles.css` | App shell + the mock platform chrome |
| `vendor/` | Bundled `html-to-image` and `jspdf` (offline, no CDN) |
