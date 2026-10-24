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

**On the vision / Presage interest.** Presage (camera biometrics) does not fit a web-security tool — it would be a separate project (idea 28), and only weakly ties to "Time" (biometrics over time). If the team wants vision *and* the security idea, the clean fit is **Gemini multimodal** for screenshot triage and headline explaining (ideas 22, 26), not Presage. Worth deciding early: security-data project (many prizes) or a vision project (fewer, but Presage/Gemini-led).

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
