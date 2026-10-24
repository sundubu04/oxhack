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

From the resources agent, 24 Oct. Licences noted; **FLAG** = limits commercial/hosted use or has a catch. Nothing here was code-reviewed, and most repos were created after 21 Oct — treat as starting points, not trusted dependencies.

### The space is already crowded — so a plain checker won't win

Within three days, many public "is my site affected" tools launched. A yet-another header checker is **not** differentiated. Our edge has to be the data/time/prediction layer and the end-user decision, not the lookup.

- **Passive header checkers:** [Secure the Web](https://securetheweb.org) (ProjectDiscovery), [Brandefense](https://atlas.brandefense.io/php-vulnerability-check), an [Eye Security Chrome/Edge extension](https://chromewebstore.google.com/detail/php2shell-checker/dakblmoboeclnnlddlcpcaoeecannhae) (closed source).
- **Version-paste sites:** php2shellcheck.com, [Arvion](https://arvion.ai/tools/php2shell), [simgen](https://simgen.dev/php-patch-check/), [php2shell.uk](https://php2shell.uk/checker).
- **Active testers (not for us):** [Aikido](https://php2shell.aikido.io/), [Pentest-Tools](https://pentest-tools.com/network-vulnerability-scanning/php2shell-scanner).
- **Open-source browser extensions (MIT):** [nocerainfosec](https://github.com/nocerainfosec/php2shell-checker), [newtro](https://github.com/newtro/php2shell-site-check), [sonuoffsec](https://github.com/sonuoffsec/php2shell-detector), [dinie](https://github.com/dinie/php2shellguard) — good references for the extension shell if we build #1. No consumer bot found.

### The data we'd actually build on (all passive / public, permissive)

| Resource | Licence | Use for us |
| --- | --- | --- |
| [OSV.dev](https://osv.dev/vulnerability/CVE-2026-109618) + distro trackers ([Debian](https://security-tracker.debian.org/tracker/CVE-2026-109618), [Ubuntu](https://ubuntu.com/security/CVE-2026-109618), [Rocky via OSV]) | Apache-2.0 | Map a host's distro/package to fixed-or-not — **avoids false "vulnerable" on backported builds** (the version banner lies) |
| [endoflife.date API](https://endoflife.date/api/v1/products/php) | MIT | "Your PHP branch is end-of-life" message; 8.1 EOL 31 Dec 2025 |
| [EPSS API](https://api.first.org/data/v1/epss?cve=CVE-2026-109618,CVE-2026-109619) | public | Exploitation-probability score **over time** — the predictive signal for the Time/HRT angle (-109618 = 0.116, 96th pct on 23 Oct) |
| [NVD](https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2026-109618) / [CISA KEV JSON](https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json) | public | Scores, CPEs, an urgency badge (neither CVE in KEV as of 23 Oct) |
| [wappalyzergo](https://github.com/projectdiscovery/wappalyzergo) / [httpx](https://github.com/projectdiscovery/httpx) | MIT | Read PHP version + CMS from headers passively, in a backend |
| [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer) | GPL-3.0 (share-alike) | The fingerprint dataset behind the above |
| [NCSC-NL/php2shell](https://github.com/NCSC-NL/php2shell) | EUPL-1.2 | Machine-readable list of affected products/appliances (SPDX) — "is my NAS/router affected?" |
| [HIBP Pwned Passwords](https://haveibeenpwned.com/API/v3) | free, no key | Password-strength step (k-anonymity), for the change-password feature |
| [W3C change-password URL](https://www.w3.org/TR/change-password-url/) | W3C | Deep-link a user straight to a site's change-password page |
| [crt.sh](https://crt.sh) / [certspotter](https://github.com/SSLMate/certspotter) | GPL-3.0 / MPL-2.0 | CT-log check for a user's own domain (memory-leak hygiene) |

### Exposure numbers (for the "problem" board)

- Shodan 21 Oct (via [Black Kite](https://blackkite.com/blog/php2shell-two-critical-remote-code-execution-vulnerabilities-in-the-php-core-)): ~1.90M PHP hosts; ~1.37M disclose an affected version, ~526K hide it; 72.5% of disclosers on end-of-life branches.
- [W3Techs](https://w3techs.com/technologies/details/pl-php): PHP on 70.3% of sites with a known server-side language.

### Signatures / detection rules (if we ever go owner-consented)

OWASP CRS PRs [#4896](https://github.com/coreruleset/coreruleset/pull/4896) and [#4899](https://github.com/coreruleset/coreruleset/pull/4899) (the latter flags a **leaked PHPSESSID response cookie** — the memory-disclosure tell), [corelight/php2shell-detect](https://github.com/corelight/php2shell-detect) (BSD-3, Zeek + Suricata), [Lexsah/php2shell-detection](https://github.com/Lexsah/php2shell-detection) (YARA/Sigma/Suricata, unvetted). Owner-consented local checkers: [MakFly/php2shell-check](https://github.com/MakFly/php2shell-check), [aancw](https://github.com/aancw/php2shell-scanner) (MIT). **Avoid WPScan** (paid for hosted/commercial), droopescan (AGPL), Patchstack (paid). **Wordfence Intelligence v2 feed** is free for commercial use with attribution (WordPress plugin vulns).

### Open conflicts to not overstate on stage

- Exploitation-in-the-wild reports conflict (watchTowr honeypots on 21 Oct per some, none per others; an attempt logged 17 Oct). Say "exploited in the wild, reports vary" and cite.
- The PHPSESSID heap-leak detail is in CRS PR #4899, not the php-src advisory. NVD scores v3.1 9.8 vs the CNA's v4 9.2.
- CVE-2026-115560 has no advisory/patch yet.

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
