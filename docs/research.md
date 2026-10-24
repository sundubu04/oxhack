# PHP2Shell: research for the OxHack idea

Compiled 24 Oct 2026. The question: what could a hackathon team build that lets **ordinary users** (not sysadmins) detect or respond to PHP2Shell, safely and legally? This file holds the brief, the open-source resources, the precedents and the ideas; the idea list is in `hack/ideas.md`.

## What happened

Two critical flaws in PHP core, nicknamed **PHP2Shell**:

- **CVE-2026-109618** — unauthenticated RCE via out-of-memory corruption. Includes an upload-progress unserializer use-after-free and a memory-disclosure bug: a multipart request that triggers an out-of-memory error leaves a dangling session pointer, and a later request can leak reclaimed heap memory in a `PHPSESSID` cookie — even if the app never calls `session_start()`. CVSS v4.0 9.2. (GHSA-w8hw-w9fx-j79w)
- **CVE-2026-109619** — unauthenticated RCE via stale global state after a fatal error (backtrace use-after-free and an OPcache type confusion). CVSS v4.0 9.2. (GHSA-6wmf-4rv5-p3rp)
- **CVE-2026-115560** — a third RCE, disclosed 23 Oct, affecting "web applications configured in an unusual way." No out-of-band release; mitigation only.

Key facts for a product:

- **Scope.** Every PHP version serving web requests, from 5.4 to 8.5. PHP runs about **70% of websites** (W3Techs: 70.2% on 8 Sep 2026). Risk is highest on Apache `mod_php`.
- **Fixed in** PHP 8.5.12, 8.4.27, 8.3.36, 8.2.35. PHP 7.4, 8.0, 8.1 get only minimal source backports; 7.3 and older get nothing. Distributions backport the fix **without changing the version string**, so `php -v` and `X-Powered-By` can read the same before and after a patch — the version number alone does not tell you if a host is safe.
- **Workers must be restarted** after patching or the old interpreter keeps serving.
- **Exploited in the wild** since 21 Oct (watchTowr honeypots). Details leaked a day before the planned disclosure.
- **Found with AI** (Wiz, OpenAI, Calif.io): "a single researcher completed in a week what previously would have taken a world-class team months." A decade-old bug. This is the story the press is running, and a judge will know it.
- **For the public** (Malwarebytes): a "trusted website may no longer be trustworthy"; eight compromised TLS certificates were found; watch for unexpected content, downloads, redirects or repeated login prompts, and don't re-enter credentials on a site behaving oddly.

## The constraint that shapes every idea

Both bugs are RCEs and one leaks memory. **Actively probing a site you do not own** to see whether it is exploitable — sending exploit-shaped multipart requests — is likely an offence under the **Computer Misuse Act 1990** (UK) and the **CFAA** (US targets), and could crash the target. The Heartbleed and Log4Shell testers that stayed clean were passive, opt-in, or tested only the user's own domain.

So a buildable, defensible product uses one of:

- **Passive signals** a normal visit already returns (response headers like `Server` and `X-Powered-By`), read once and cached — and treated as a weak hint, never proof, because of the version-string problem above.
- **Existing public datasets** that already scanned the web (urlscan.io, Shodan, Censys, HTTP Archive, Certificate Transparency logs), so we never touch the target ourselves.
- **Verified ownership**: the user proves they control the domain (a DNS TXT record or a file), and only then do we check it directly.

An idea that needs active exploitation of other people's sites is out.

## Matching our idea to the OxHack tracks

The brief (`hack/opening-ceremony.md`): main theme **"Time"** (First, Runner-up, Best Handmade), sponsor prizes separate and **stackable**, judging **science-fair style, 4–5 min per judge** (a table demo, not a stage pitch).

The unlock is that a PHP2Shell tool for ordinary users is naturally a **time story told with data**: an RCE went live on 21 Oct, the world is patching, and the interesting question for a user is *when is this site safe, and what do I do until then*. That reframes the tool as a time-series data-analytics product, which is exactly HRT's brief.

**The synthesis to build: "Time to Safe"** (idea 23 + 25 + 26 features). Using only public datasets over time — never touching a target — estimate each site's risk and the web-wide patch curve, predict when a site becomes safe, and give a non-technical user a clear decision (use it / wait / change your password), with an optional spoken verdict and a Gemini screenshot explainer.

How that one build maps to prizes:

| Track / prize | How we hit it |
| --- | --- |
| **Main — "Time"** | The whole product is the race over time: exploitation live from 21 Oct vs the patch curve; a per-site "danger timeline" and a predicted safe date |
| **HRT — data for predictions & decisions** | Ingest public datasets (urlscan, Shodan/Censys, CT logs, HTTP Archive, W3Techs, OSV, CISA KEV, EPSS), **predict** time-to-safe per site/sector, drive the user's **decision**. This is the core, not a bolt-on |
| **Snowflake / Tiger Data** | The time-series store and analytics behind the predictions (Tiger Data = time-series Postgres; Snowflake = the warehouse). Picking one strengthens the HRT entry too |
| **Gemini API** | Multimodal: explain a user's screenshot of a site behaving oddly, and ground "explain this scary headline" (ideas 22, 26) |
| **ElevenLabs** | Speak the verdict for low-vision / older users (idea 27) — a genuine accessibility use, not a gimmick |
| **Delta** | Build it in Delta with teammates + agents and share the threads; rewards the snappy UX we want anyway (Speed 30%) |
| **Vultr** | Host the backend |
| Best Handmade (Citadel) | Not our lane unless we add hardware; skip |
| Solana | No fit; skip |

So one coherent build can be entered for the main Time prize **and** up to six sponsor prizes. That beats chasing prizes with separate features.

**What to decide early (for the team):**
- **Security-data project vs vision project.** The security idea stacks the most prizes and fits Time + HRT cleanly. A Presage (camera-biometrics) project is a different build that only weakly fits Time; it's an either/or, not an add-on. Gemini vision, by contrast, fits the security idea as a feature.
- **How much to predict vs report.** A real prediction (time-to-safe from historical patch speed) wins HRT; a pretty dashboard of current state does not. Keep at least one honest predictive model, with its confidence shown.
- **Science-fair format.** 4–5 min at a table means a fast live demo and a single poster beat a slide deck. `oxh-demo` output doubles as the DEV write-up and the fallback.

## Open-source resources

Filled from the resources agent. Licence noted; flag anything that blocks commercial or hosted use.

_(pending — resources agent running)_

## Precedents: how past vulnerabilities reached the public

Filled from the precedents agent (Heartbleed, Log4Shell, MOVEit, Have I Been Pwned, Safe Browsing, and more).

_(pending — precedents agent running)_

## Sources

- Wiz, PHP2Shell write-up — https://www.wiz.io/blog/php2shell-php-rce
- watchTowr FAQ — https://watchtowr.com/intelligence/php-cve-2026-109618-faq/
- Malwarebytes (for users) — https://www.malwarebytes.com/blog/bugs/2026/10/php2shell-why-websites-are-going-offline-for-emergency-security-updates
- Krebs on Security — https://krebsonsecurity.com/2026/10/widespread-php-flaw-may-cause-many-site-outages-today/
- CERT-EU advisory 2026-018 — https://cert.europa.eu/publications/security-advisories/2026-018
- CISA alert — https://www.cisa.gov/news-events/alerts/2026/10/21/critical-vulnerabilities-php-require-immediate-patching
- NCSC UK — https://www.ncsc.gov.uk/news/critical-security-issue-affecting-php
- Rapid7 analysis — https://www.rapid7.com/blog/post/etr-cve-2026-109618-and-cve-2026-109619-critical-unauthenticated-remote-code-execution-in-php/
- Google Cloud response — https://cloud.google.com/blog/products/identity-security/responding-to-core-php-vulnerabilities-cve-2026-109618-cve-2026-109619
- W3Techs PHP usage — https://w3techs.com/technologies/details/pl-php/8
- Debian/Ubuntu backport note (version string unreliable) — https://lilting.ch/en/articles/php2shell-official-patch
