# Ideas

`oxh-ideate` writes here. One row per idea; the long list stays, so a dropped idea can come back.

**Theme (24 Oct 2026):** PHP2Shell — CVE-2026-109618 and CVE-2026-109619, a pair of critical unauthenticated RCEs in PHP core, disclosed and patched 21 Oct, exploited in the wild since. A third, CVE-2026-115560, followed on 23 Oct for unusual configs. PHP runs ~70% of websites. We want something **ordinary users** (not sysadmins) can use to detect or respond to it. See `docs/research.md` for the brief and sources.

**The hard constraint: stay passive and lawful.** One bug leaks server memory, and both are RCEs. Actively probing a site you do not own to see if it is exploitable is likely an offence under the Computer Misuse Act 1990 (and the CFAA for US targets), and sending exploit-shaped multipart requests could crash the target. So every idea here must either (a) read only data that a normal visit or an existing public dataset already provides, or (b) act only on a site whose owner has opted in and proven ownership. Ideas that need active exploitation are out, and marked so.

## Scores

Event criteria are not set, so these are our own filters, 1 to 5 (5 is best). **Legal** is how safely it stays inside the constraint above. Total is the straight sum (max 25); it is a sort key, not a verdict.

| # | Idea | Who it is for | The wow moment | Demo | Build | Data | User | Legal | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Is this site still safe?** A public page + browser extension that, for any site you visit, shows what it runs and whether it looks patched, from passive signals and public scan data, with a plain verdict and what to do | Anyone who banks, shops or logs in on the web | Type a domain, get a calm green/amber card in 2 s with "PHP seen in the last scan, version header hidden, patched hosts nearby" and "change your password if you reused it" | 5 | 4 | 4 | 5 | 5 | 23 |
| 2 | **Patch-watch board** for the sites people actually use | The public, journalists, the team's own friends | A live wall of 200 well-known UK/edu sites with patched / unknown / went-offline, sourced and timestamped, updating during the demo | 5 | 4 | 3 | 4 | 5 | 21 |
| 3 | **"Should I change my password?"** — the Heartbleed-for-PHP2Shell checklist | Any logged-in user of affected sites | Paste the sites you have accounts on; get a ranked list of which to change first and why, with the memory-leak risk explained | 4 | 5 | 4 | 5 | 5 | 23 |
| 4 | **One-command check for my own small site** (verified owner) | Freelancers, charities, club/society webmasters | `npx oxh-phpcheck mysite.org` (after a DNS/file proof) prints version, patch status, worker-restart reminder, and a fix plan | 4 | 4 | 4 | 4 | 5 | 21 |
| 5 | **WordPress plugin: Am I patched?** | The millions of non-technical WP site owners | Install, click once: a dashboard card says "PHP 8.2.19, needs 8.2.35 — here is the message to send your host," with a copy button | 4 | 4 | 5 | 5 | 5 | 23 |
| 6 | **Agent that drafts the email to your host** | Owners who can't patch themselves | Pick your host from a list; the agent writes the exact support ticket with the CVE, your version and the ask, and the escalation if they stall | 4 | 5 | 4 | 4 | 5 | 22 |
| 7 | **Canary token for PHP2Shell** | Slightly technical site owners | Drop one file on your server; if it is ever hit in a way the exploit would cause, you get an email. A honeypot you own, so fully legal | 4 | 3 | 3 | 3 | 5 | 18 |
| 8 | **Plain-English explainer with a live memory-leak visual** | The public, students, newsrooms | A scrollable page that shows, with a safe animation, how a leaked PHPSESSID cookie could spill a stranger's data — no live exploit | 5 | 5 | 4 | 3 | 5 | 22 |
| 9 | **"Was I exposed?" for site owners** (verified) | Owners who ran an affected version | Enter your domain + prove ownership; cross-check CT logs for new certs and known-bad windows, and advise on secret rotation | 3 | 3 | 3 | 3 | 4 | 16 |
| 10 | **Host league table** | Everyone choosing where to host | Rank the big shared hosts (SiteGround, cPanel, WP Engine, Cloudflare) by how fast they shipped a fix or mitigation, from their own notices | 4 | 4 | 3 | 3 | 5 | 19 |
| 11 | **Family/again-check bot** | Non-technical people and their helpful relatives | A chat where you name the sites a parent uses; it checks each passively and gives a printable "do this" sheet | 4 | 4 | 3 | 4 | 5 | 20 |
| 12 | **Browser guard that warns in the moment** | Everyday browsing | While you browse, a quiet badge flags a site whose server looks unpatched or has suspicious new behaviour; click for the why | 4 | 3 | 3 | 4 | 4 | 18 |
| 13 | **Email-domain check: could my provider be hit?** | Anyone with email on a small provider | Enter your email domain; see whether its web stack looks PHP-based and unpatched, from passive signals | 3 | 4 | 3 | 3 | 4 | 17 |
| 14 | **Open dataset + API of who's patched** | Developers, other hackathon teams, researchers | A clean API over endoflife.date, OSV, CT logs and passive scans, so anyone can build their own checker; we ship one on top | 3 | 4 | 4 | 2 | 5 | 18 |
| 15 | **Teachable moment: a safe "capture the flag"** | Students learning security | A sandboxed vulnerable PHP app (ours, local) where you watch the memory leak happen, then patch it and watch it stop | 4 | 3 | 4 | 3 | 5 | 19 |
| 16 | **Nudge campaign kit for CERTs/newsrooms** | People who warn the public | A generator for shareable cards: "X% of the sites we checked still look unpatched," with the method and caveats | 3 | 4 | 3 | 2 | 5 | 17 |
| 17 | **Slack/Discord bot for small teams** | Dev-adjacent small teams | `/phpcheck` your own domains in a channel; daily digest of which moved to patched | 3 | 4 | 3 | 3 | 5 | 18 |
| 18 | **"Supply-chain" view: the sites a page loads** | Privacy-minded users | For a page you open, list the third-party domains it pulls scripts from and flag any that look unpatched — your data crosses them too | 4 | 3 | 3 | 3 | 4 | 17 |
| 19 | **Accessibility-first alert for at-risk users** | Older and less technical people | A very large, two-button "is my bank ok right now?" page for one or two sites the user cares about, read aloud | 4 | 4 | 3 | 4 | 5 | 20 |
| 20 | **Post-mortem timeline, auto-built** | Journalists, students | A living timeline (discovery, disclosure, exploitation, patches) assembled from sources, with the AI-found-it angle | 4 | 5 | 4 | 2 | 5 | 20 |
| 21 | **Certificate-change watch for your own domains** | Owners worried about memory leak | Watch CT logs for your domains and alert on an unexpected new cert (a weak sign of possible abuse); legal, read-only | 3 | 4 | 4 | 3 | 5 | 19 |
| 22 | **"Explain this scary headline"** assistant | The general public reading the news | Paste a PHP2Shell headline; get a grounded, calm explanation of whether it affects you and what to actually do | 4 | 5 | 4 | 3 | 5 | 21 |

## Shortlist (eight to take to prior art and the panel)

**Steer (Eun, 24 Oct): aim at non-technical end users**, not site owners. So the shortlist is the user-facing eight: **1** (passive "is this site safe?" checker + extension), **3** (password-change playbook), **2** (live patch-watch board of sites people use), **8** (explainer with a safe memory-leak visual), **22** ("explain this scary headline" assistant), **19** (accessibility-first alert for one or two sites you care about), **11** (check a relative's sites), **12** (in-the-moment browser guard). The owner-focused ideas (4 one-command, 5 WordPress plugin, 6 host-email agent, 17 Slack bot) drop off this shortlist, though a verified-owner check could still be a secondary feature.

## Data, time and vision angles (added after the brief was known, 24 Oct)

The main theme is **TIME**; HRT rewards **data for predictions and decision-making**; sponsor prizes stack. These lean into that. They keep the end-user steer and the passive/legal constraint.

| # | Idea | Who it is for | The wow moment | Demo | Build | Data | User | Legal | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 23 | **Time to Safe** — the patch race, as a data story. Using only public datasets over time, show exploitation (from 21 Oct) against sites patching day by day; for a site you name, how long it has looked unpatched and a predicted date it will be safe, with a plain decision | Everyday web users | A single site's "danger timeline": a red line (exploit live) crossing a grey one (still unpatched for 3 days), and "likely safe by Sun — until then, don't log in" | 5 | 3 | 4 | 5 | 5 | 22 |
| 24 | **Web risk forecast** — a daily "weather map" predicting which sectors/hosts clear the vuln next, from the patch curve so far | The public, newsrooms | A map/forecast: "shared-hosting sites ~60% safe; small .org sites lag, ~4 more days," updating live | 4 | 3 | 3 | 3 | 5 | 18 |
| 25 | **Change-password priority engine** — rank your accounts by risk over time, from exposure + EPSS trend, so you fix the urgent ones first | Any logged-in user | Paste your sites; a ranked list with a tiny trend sparkline each and "do these 3 tonight" | 4 | 4 | 4 | 5 | 5 | 22 |
| 26 | **Screenshot triage** (Gemini vision) — paste a screenshot of a site doing something odd (surprise popup, redirect, login loop); Gemini explains whether it looks compromised and what to do | Non-technical users who sense something is "off" | Drop a screenshot, get "this overlay asking for card details is not part of your bank — leave and call the number on your card" in 3 s | 5 | 4 | 3 | 5 | 5 | 22 |
| 27 | **Read-it-to-me safety line** (ElevenLabs) — the #1 verdict, spoken, for one or two sites someone cares about | Older / low-vision / low-literacy users | Big button, a calm voice: "Your bank looks safe and up to date. No action needed." | 4 | 4 | 3 | 4 | 5 | 20 |
| 28 | **Presage wellbeing-over-time demo** (off our security theme) — camera biometrics (heart rate, stress) tracked over time | General | A live heart-rate trace from the laptop camera | 4 | 3 | 3 | 2 | 4 | 16 |

**Lead candidate (after the research): #23 + #2 combined — a live "Time to Safe" tracker.** The precedents agent found the open slot: *no one is tracking which well-known sites went offline, came back, or patched* (councils, the Met, Nintendo, Pokémon all went dark). Build a sourced, live **timeline** of the sites people actually use — offline / back / patched / unknown — with a predicted "safe by" per site from the patch curve, and a plain decision for the visitor. It's on theme (Time = the timeline), it's the HRT data-prediction-decision story, it's legal (built from sites' own statements + passive signals, no active scanning, no unpatched-target list), and it fills a real gap rather than adding a 15th header checker. See `docs/research.md`.

**On the vision / Presage interest.** Presage (camera biometrics) does not fit a web-security tool — it would be a separate project (idea 28), and only weakly ties to "Time" (biometrics over time). If the team wants vision *and* the security idea, the clean fit is **Gemini multimodal** for screenshot triage and headline explaining (ideas 22, 26), not Presage. Worth deciding early: security-data project (many prizes) or a vision project (fewer, but Presage/Gemini-led).

## Fun route: a phone-vision game that collects data (added 24 Oct)

Eun wants a fun, demo-able angle: use a phone **vision** API to make a productive, Pokémon-Go-style game that **collects a real dataset**. Two vision APIs are on offer:

- **Gemini** (multimodal) — reads the *world*: identify objects, species, text, scenes. The "catch real things" route.
- **Presage SmartSpectra** — reads your *body*: contactless heart rate + breathing (plus HRV, emotion, focus) from a face in ~20 s, FDA-cleared, free for the event. The "vitals drive the game" route. Needs a mobile/native SDK and a ~20 s still window (slower demo; note vs Delta's speed prize).

The flywheel that makes it *productive* and nails **HRT + Time**: every catch is time- and place-stamped, so the data players collect trains a live model that **predicts where/when the next one appears**, and players follow that prediction. Data → prediction → decision, and the collection grows over time.

Scored out of 25: **Fun** (demo delight), **Data** (is the dataset genuinely useful), **Prize** (how many tracks it stacks), **Build** (in ~20 h), **Table** (works in a 4–5 min science-fair demo).

| # | Idea | Vision API | The hook | Fun | Data | Prize | Build | Table | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | **SpawnCast / ChronoDex** — catch real things into a dex; sightings are time+place stamped and a live model predicts the next spawns, which players chase | Gemini | "The game you play *makes* the forecast you play by" — the prediction flywheel | 5 | 5 | 5 | 3 | 4 | 22 |
| G2 | **PriceDex** — hunt products, snap the price tag; crowd-sourced price/inflation data over time, with a next-week price forecast | Gemini (OCR) | "Changes in value over time" — the organisers' own HRT example, as a game | 4 | 5 | 5 | 4 | 4 | 22 |
| G3 | **BioDex** — photograph plants/bugs/birds; Gemini IDs the species; a biodiversity map that fills over the weekend | Gemini | iNaturalist as a catching game; seasonal/time-of-day spawns | 4 | 5 | 4 | 4 | 3 | 20 |
| G4 | **Calm Catch** — a creature you can only catch by *lowering your heart rate*; Presage reads your pulse live | Presage | Judges calm themselves and watch their own pulse catch it — the biggest instant wow at a table | 5 | 3 | 4 | 3 | 5 | 20 |
| G5 | **Calm Duel / Face-Off** — two players, whoever stays calmest under distraction wins | Presage | Two judges duel at the table; collects a stress-response dataset | 5 | 3 | 4 | 3 | 5 | 20 |
| G6 | **Breath Quest** — a game you steer with your breathing rate | Presage | Control a game with your breath; breathing-control data over time | 4 | 3 | 4 | 3 | 4 | 18 |
| G7 | **Hype Meter** — everyone at the venue scans in; a live "mood map" of the room over the event | Presage | Scan the judges, show the room's live energy over time | 4 | 4 | 4 | 3 | 4 | 19 |
| G8 | **SidewalkDex** — catch accessibility features/barriers (ramps, steps, tactile paving); a civic access map | Gemini | Productive/civic; Project-Sidewalk-as-a-game | 3 | 5 | 4 | 4 | 3 | 19 |
| G9 | **LitterLegends** — "defeat" litter by photographing it; a cleanup heatmap that changes over time | Gemini | Visibly good; type-classified litter data | 4 | 4 | 4 | 4 | 3 | 19 |
| G10 | **Pulse Pet** — a Tamagotchi that mirrors your vitals; thrives when you're calm and active | Presage | Longitudinal self-data; cute | 4 | 2 | 3 | 3 | 4 | 16 |
| G11 | **Hybrid: excitement-catch** — a Gemini catch game where your heart rate (Presage) sets the catch rate | both | Stacks both vision prizes; harder to build | 4 | 4 | 5 | 2 | 3 | 18 |

**Lead fun idea: G1 (SpawnCast) or its HRT-flavoured twin G2 (PriceDex).** Both are true to "Pokémon Go that collects data," both make the data *productive* through a prediction that feeds back into play, and both stack **Main (Time) + HRT + Gemini + Snowflake/Tiger Data + Delta + Vultr**, with ElevenLabs for a creature "call". G2 is the sharper HRT pitch (a trading firm's judges love price/market data over time); G1 is the more flexible, more universally fun one. If pure **demo delight** matters most, **G4 Calm Catch (Presage)** is the biggest table wow but a thinner dataset and a slower 20 s reading.

**Buildability note.** The Gemini catch games are a camera web app → Gemini API → a store (Tiger Data/Snowflake) → a simple prediction (density by time/place is enough to show the flywheel) → a map. Buildable. The Presage games need its mobile/native SDK and a ~20 s window, so more platform friction and a less "snappy" demo.

**Demo-at-a-table plan (either route).** Pre-seed a handful of "spawns" — printed cards or objects on the table (G1), product tags (G2), or the judges' own faces (G4). The judge catches two or three, the dex fills, and the prediction/map visibly updates. That is the whole 4–5 minutes.

## Neo-geocache: real-life Easter eggs (vision + time)

Classic geocaching uses GPS coordinates. The twist: **the vision model is the lock.** You hide an "egg" (a message, photo, voice note, AR gift, dare, coupon) pinned to a real-world *view* — an object, a mural, a plaque, a storefront — and the camera recognising that view is what unlocks it. GPS can get you close; **vision confirms you're at the exact thing**, so hides can be precise and playful indoors where GPS is useless (and so it demos on a tabletop).

**Where data and time come in.** Every hide and find is time- and place-stamped, so the log is a spatiotemporal time-series — the native shape for **Snowflake / Tiger Data**, **HRT** (predict where/when eggs are findable, and decide where to hide), and **Time** (eggs that unlock on a schedule, expire, or capsule into the future). The game you play builds the forecast you play by.

| # | Idea | The hook | Fun | Data | Prize | Build | Table | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N1 | **Chronocache** — vision-locked eggs with a *time rule*: unlock now, at a future date (capsule), only in a window (ephemeral), or on a schedule. Finds + hides train a "where/when to look next" forecast | Vision is the lock, time is the gate, and the map predicts the next finds — all four prize angles in one loop | 5 | 5 | 5 | 3 | 4 | 22 |
| N2 | **Time Capsule** — hide a message/photo/voice pinned to a real spot; it stays locked until a future time; finders open it only after it matures | "Leave something for whoever stands here in 6 months" — pure Time, genuinely moving | 5 | 4 | 4 | 4 | 4 | 21 |
| N3 | **Vision dead-drop** — no coordinates at all; the clue *is* a photo, and you find it by matching the view. Eggs can self-destruct after one read or after a time | The cleverest mechanic: scene-matching replaces GPS; spycraft vibe | 4 | 4 | 4 | 3 | 4 | 19 |
| N4 | **Data-bounty eggs** — an egg rewards you for capturing a specific real-world datum nearby (snap the thing next to it); the aggregate is a directed, productive dataset | Geocache meets citizen science — the game *is* the data collection | 4 | 5 | 5 | 3 | 3 | 20 |
| N5 | **Then & Now** — pin old photos/stories to places; point your camera to see the past layered on the present, and add your own over time | Local history that grows; then-vs-now is the Time axis | 4 | 4 | 4 | 3 | 3 | 18 |
| N6 | **Venue hunt** — a time-boxed egg trail around the OxHack venue (or freshers' week): eggs teach you the place and expire when the event ends | Most demoable of all — hide eggs around *this* room and have judges find them | 5 | 3 | 3 | 4 | 5 | 20 |
| N7 | **Predictive hiding** — the app suggests good hiding spots from foot-traffic and find data, and forecasts a cache's "findability" over the day | Data → a decision (where to hide); the clean HRT story | 3 | 5 | 5 | 3 | 3 | 19 |
| N8 | **Echo eggs** (ElevenLabs) — the egg is a voice note tied to a place; point your camera to hear it. A crowd-built audio ghost tour | Sensory and shareable; narration on a schedule (Time) | 4 | 3 | 4 | 3 | 4 | 18 |

**Lead: N1 Chronocache**, with **N2 Time Capsule** as the warmer, simpler cut and **N4 Data-bounty** as the most HRT-productive cut. N1 stacks **Main (Time)** — time-gating is the core mechanic, **HRT** — the find/hide forecast, **Gemini** — the vision lock, **Snowflake / Tiger Data** — the spatiotemporal log, plus **ElevenLabs** (voice eggs), **Delta**, **Vultr**.

**How the vision lock works (buildable in the time).** GPS as a coarse filter, then a scene match to confirm the exact anchor: Gemini ("is this the same object/view?") for the quick version, or CLIP-style image embeddings with a similarity threshold for something more robust. A simple density/kNN model over the time-stamped log is enough to show the prediction flywheel.

**Table demo.** Hide an egg on an object in the room with a 2-minute unlock. A judge points their phone, the vision model confirms the anchor, the countdown ends, the egg opens live — then show the map, the growing archive and the "where/when to look next" forecast. Novel, personal, and it fits the 4–5 minutes.

## Long list

Captured above (1–22). More raw seeds, not yet scored: a QR code on a "we're patching" holding page that links to the explainer; a uptime-style "is it down because of PHP2Shell?" checker; a diff tool that shows what a site's headers looked like before/after; a "trust receipt" a patched site can display; a Thunderbird/Outlook add-in that flags links to likely-unpatched domains.

## Prior art

Filled from the research agents (see `docs/research.md`). An idea that already exists is not dead, but its pitch must say what is new.

| Idea | Closest existing thing | What ours does that it doesn't | Source |
| --- | --- | --- | --- |
| 1, 3 | Heartbleed: filippo.io/Heartbleed, LastPass checker, Mashable password list (2014) | Those were single-vuln, active TLS probes; ours is passive, PHP-specific, and bundles the password step | pending (precedents agent) |
| 2, 10 | Log4Shell / MOVEit "who is affected" lists, NCSC-NL GitHub list | A consumer-readable live board of sites people use, not a dev list of software | pending |
| 4, 5, 17 | WPScan, droopescan, version checkers | Consumer framing, verified-owner only, no active exploitation | pending |
| 8, 15, 20, 22 | News explainers (Malwarebytes, Krebs), CVE write-ups | Interactive and grounded; a safe visual, not prose | pending |
| 9, 21 | crt.sh, certspotter, Have I Been Pwned | Framed around this incident and this user's own domains | pending |
