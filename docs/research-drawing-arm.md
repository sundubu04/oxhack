# Drawing-clock arm: prior art and logistics

Compiled 24 Oct 2026 for Route D in `hack/ideas.md`: a robot arm on a whiteboard that draws, erases and redraws, opens with a clock as the joke, and takes real video and voice. This file covers what already exists, why drawing is slow today, why a live model API cannot drive the arm, the deterministic Fourier pipeline, and a published benchmark we could beat. Anything marked UNVERIFIED could not be confirmed from a primary source. The page is `docs/pages/drawing-arm-research.html`.

## The short answer

- **A robot that writes the time on a whiteboard and wipes it is 12 years old.** The Doodle Clock (2012), the Plotclock (2014) and Maurice Bos's Whiteboard Clock (2015) all do it, from a fixed font, every 1 to 5 minutes. Maarten Baas's *Real Time* (2016) owns the art version. The clock is the joke, not the claim.
- **Erasing is the weak point in every build.** Markers dry in about 30 minutes, felt leaves residue, a magnetic board scratched in a day, and Scribit needs its own heat-vanishing ink.
- **Nobody sells a reliable, responsive whiteboard robot today.** iBoardbot's site is gone; Joto's and Scribit's sites stop at ©2023 and ©2022. None of them answers a question by deciding what to draw.
- **A live model API cannot drive the arm.** The models that output actions are waitlist-only, the public ones return text points, video goes in at 1 frame a second, answers take about 1 to 3 s, and a servo wants a command every 20 ms. Models also miss on precise points and give different answers to the same prompt.
- **Every working AI drawing system splits the job:** the model decides what to draw, deterministic code moves the pen. That is our architecture too, and the Fourier pipeline is the fast, exact half.
- **The benchmark to beat is the clinical Clock Drawing Test.** In published tests, no LLM fully passed the MoCA clock (BMJ, Dec 2024), and only 2 of 12 models set the hands to the right time (Galatzer-Levy et al., Oct 2024). Healthy adults over 55 take 35.0 s on average to draw it (Davoudi et al., 2021).

## 1. What already exists

### Clocks that draw the time

| Build | Year | How it draws and erases | Known problems | Source |
| --- | --- | --- | --- | --- |
| Doodle Clock, Ekaggrat Singh Kalsi | 2012; v2 2015 | Servo arm with a dry-erase marker; a second servo drives a felt eraser; rewrites only the digits that changed | Marker "would dry up after only 30 minutes of use"; v2 moved to a magnetic board, which scratched after about a day | makezine.com, hackaday.io/project/7930 |
| Plotclock, "joo" (Johannes Heberlein) | Feb 2014 | Arduino and 3 servos; picks up an eraser and wipes before each new minute; free files on Thingiverse | A 2019 Cornell rebuild: writing left on the board after erasing, digits sometimes unreadable from servo error. Cycle time UNVERIFIED | elektormagazine.com, Cornell ECE5725 |
| Whiteboard Clock, Maurice Bos | Feb 2015 | Marker tip inside the eraser head, so the same arms write and erase; rewrites every 5 minutes | Hacker News (784 points): marker drying, erasing "clumsy like a toddler" | hackaday.com, news.ycombinator.com/item?id=9070140 |
| *Real Time* Schiphol Clock, Maarten Baas | 2016 | A 12-hour film of a man painting and wiping the hands each minute; no machine | A judge will likely know it | Wikipedia, news.schiphol.com |

### Whiteboard and wall robots that erase

| Product | Launch | Price | How it erases | Speed | Status |
| --- | --- | --- | --- | --- | --- |
| iBoardbot (JJRobots) | Kickstarter 2016, 203 backers, £31,765 | $171 kit, $234 built | Servo wiper, draws on glass | UNVERIFIED | Site did not resolve 24 Oct 2026; likely dead (UNVERIFIED) |
| Joto (Those, London) | Kickstarter Mar 2017, over £362k, 1,800+ units | from £199 | Arm holds a pen and an eraser; dock stops the pen drying | UNVERIFIED | Site shows ©2023 |
| Scribit (Carlo Ratti, Makr Shakr) | Kickstarter 2018, $1.64M from 4,352 backers | $299 early, $449 to $499 retail | Retraces every line with an eraser heated to 65 °C; needs its own heat-vanishing ink | A drawing takes "minutes to two hours"; erasing "within minutes" (Inverse, Nov 2018) | Shipping slipped to 2019; site shows ©2022 |

### Robots that roll on the board

Added 24 Oct 2026 after the hardware pivot to a mobile bot whose marker tilts one way to draw and the other to erase.

| Thing | What it does | What it teaches us | Source |
| --- | --- | --- | --- |
| Root (Harvard Wyss, then Root Robotics, then iRobot Education); patent US11529740B2, priority Apr 2014 | Drives on vertical magnetic whiteboards; one motor moves a double-ended arm through three states: pen down, neutral, eraser down | Our tilt-to-draw, tilt-to-erase idea exists: credit it. Put the marker at the centre of rotation so turns leave a dot; offset the eraser to the rear. The patent blames drift on gravity ("deformation and slipping of the tire material"), calibrates it per board, finds the board edge with a downward optical array and bumpers, and can correct position from cameras or landmarks | patents.google.com/patent/US11529740B2 |
| CMU robotics capstone, "Friction Force Explorers" | Two mecanum-wheel robots share one drawing; AprilTags in the four corners and on each robot; planning off the robot | AprilTags give an absolute position cheaply. Bumps pushed the pen off, and holding the pen down burned out its motor | github.com/rachelholladay/robotics_capstone |
| Dusty Robotics FieldPrinter | Prints building layouts on floors, tracked live by a stationary total station; claims 1/16 in (vendor claim) | At scale, drift is solved with an external absolute reference, not wheel odometry | dustyrobotics.com |

For us: an overhead camera with AprilTags on the bot and the board corners (deterministic vision, not a model), plus re-homing on the board edge between clocks. A flat board removes the gravity drift that Root's patent describes. The fixed arm needs none of this, because its joint angles are absolute.

### Desktop arms and plotters

| Machine | Top speed | Price | Note |
| --- | --- | --- | --- |
| AxiDraw V3 (Evil Mad Scientist, 2016) | 380 mm/s (15 in/s), repeatable to 0.1 mm only at low speed | replaced by NextDraw 8511, $699 at launch | Its maker put a 200-word letter at 10 to 15 minutes |
| Dobot Magician | 0.5 m/s | £876.98 | 320 mm reach |
| Rotrics DexArm | 500 mm/s | $799 to $1,049 | Kickstarter 2019 as Hexbot, $846,910 |
| uArm Swift Pro | 100 mm/s | $749 | Discontinued or scaled down |
| Line-us | UNVERIFIED | £98 | Small connected arm, Kickstarter 2017 |
| Makelangelo (polargraph) | no official figure | | One user: about 8 hours for a photo |
| Sisyphus / Oasis sand tables | UNVERIFIED | $1,780 to $11,000 / $149 | Erase for free: each pattern draws over the last |

### Portrait robots, and how slow they are

| System | Time per drawing | Source |
| --- | --- | --- |
| Patrick Tresset's "Paul" | 20 to 40 minutes, about 30 most cited | ispr.info (Slate, 2012) |
| Ai-Da | 45 min to 1 h 15 per portrait; 6 to 8 h for the Turing paintings | africanews.com, 2022 |
| FRIDA (CMU, ICRA 2023) | about an hour learning its brush, then "a few hours" per painting | CMU news, Pittsburgh Magazine |
| AiSketcher (2020, 3-DOF arm) | "within two minutes" per portrait on average | arXiv 2005.05526 |
| SketchBot (Picture Mosaics, event booths) | vendor claims under 50 s; 2,500+ portraits over 4 days at IAAPA 2023 | picturemosaics.com |

### AI drawing systems

| System | What the model does | Time | Source |
| --- | --- | --- | --- |
| SketchAgent (MIT, CVPR 2025) | Claude 3.5 Sonnet writes Bézier strokes as text on a 50×50 grid; screen only, no robot | about 20 s and $0.05 per sketch; about 8 s per stroke when drawing together | arXiv 2411.17673 |
| Sketch-RNN (Google, 2017) | Trained on Quick, Draw!; outputs pen offsets and pen state | about 4 s (SketchAgent's figure) | arXiv 1704.03477 |
| SVGDreamer | Text to SVG by optimisation | about 1.6 h (SketchAgent's figure) | arXiv 2312.11556 |
| Osedea, Spot draws on voice (16-hour hackathon, May 2026) | Whisper, then GPT-4o picks the object, SDXL makes 4 images, GPT-4o picks the simplest outline; OpenCV traces it to SVG, then G-code | not reported | osedea.com |
| UNSW, HRI 2025 | Fine-tuned GPT-3.5 pulls the request from conversation; Stable Diffusion makes the image; an xArm traces it | not reported | HRI 2025 |
| Exupery (Boris Smus, 2017) | Voice to a Quick, Draw! sketch on an AxiDraw | not reported | smus.com/exupery |
| Google Poster Maker (Deeplocal, I/O 2018) | Plotter driven by Google Assistant voice commands; open source | not reported | deeplocal.com |

No project was found with a model inside the motion loop of a pen plotter or arm.

### Hackathon and student projects a judge may have seen

- **Robotticelli** (La Machine hackathon, Amsterdam, early Oct 2026): an SO-101 arm photographs you and draws your portrait live; the team says it won first place (self-reported). The closest in spirit, and recent.
- **Dry Erase Plotter** (Devpost): a two-stepper whiteboard plotter drawing stock data from an API, with no eraser. Year UNVERIFIED.
- **NAU capstone** (2021): a web-controlled whiteboard robot that writes, erases and checks the board with a camera; weak eraser, less accurate than its target.
- **AutoWhiteboardBot** (Hackaday, May 2020): three markers and a felt eraser. **Fab Academy 2025**: speech via Whisper triggers pre-made drawings on a pen plotter.

## 2. Why drawing is slow and costly today

- **Machines take minutes to hours.** Scribit: minutes to 2 hours a drawing. AxiDraw: 10 to 15 minutes a letter. Portrait robots: 20 minutes to several hours. Only event booth bots claim under a minute, and none of the clock builds publishes a redraw time.
- **AI planners add their own time before a pen moves.** SketchAgent needs about 20 s to compute one sketch; FRIDA needs hours.
- **People pay for hand drawing and writing.** Handwrytten runs 175 robots (Jan 2023) and charged $3.75 a card in 2022; Bond ran 11 machines at 500 to 700 notes a day (secondary source). Whiteboard-animation videos cost $1,000 to $2,000 per finished minute with a 20-working-day turnaround (TruScribe, citing Blue Carrot 2025), though those are made digitally.
- **Teachers spend class time drawing.** Across 31 biology class sections at UBC, writing on the board or projector in real time took 14.5% (± 15.8%) of class time (PLoS One, 2019).

## 3. Why we can't just wire up a live model API

"GPT-Astra" here means a live multimodal assistant: OpenAI's Realtime API, Google's Project Astra / Gemini Live, or a robotics model.

| Reason | The fact | Source |
| --- | --- | --- |
| Nothing to wire up | Models that output motor actions are closed: Gemini Robotics 2 is waitlist-only, On-Device 2 is "Trusted Testers" only, the hosted Pi API is waitlist-only, OpenAI has no robotics API (it plans a humanoid demo in 2027, press reports only). The public Gemini Robotics-ER 2 preview returns text: points "[y, x] normalized to 0-1000", boxes, and trajectories as short point lists | ai.google.dev robotics overview (read 24 Oct 2026); DeepMind model card, 30 Jul 2026; pi.website |
| Too slow for the loop | The Live API takes video "at 1 FPS". Time to first audio is 0.63 to 2.99 s across current realtime models (Artificial Analysis, July 2026). A hobby servo takes a command every 20 ms (50 Hz); GRBL steps at up to 30 kHz. DeepMind itself needed a decoder on the robot and chunked actions to reach 50 Hz (about 250 ms end to end) | Vertex AI Live API docs (22 Oct 2026); artificialanalysis.ai; OpenMV; github.com/gnea/grbl; arXiv 2503.20020 |
| Imprecise | On Point-Bench, where any point inside the object counts, GPT-4o scored 29.5% and Gemini 2.5 Flash 46.8%. On simple geometry, four VLMs averaged 58.07% against 100% for humans. A clock needs a true circle and evenly spaced ticks | arXiv 2505.09990; arXiv 2407.06581 |
| Not repeatable | 1,000 runs of one prompt at temperature 0 gave 80 different completions, so the clock would differ every take: bad for a rehearsed demo | thinkingmachines.ai, Sep 2025 |
| Slow to draw | SketchAgent takes about 8 s a stroke; a 30-stroke clock would be about 4 minutes of model time (our arithmetic) | arXiv 2411.17673 |

**Where a model does belong** (1 s is fine here, outside the motion loop):

- **Understanding the request**: speech to intent ("draw what time it is in Tokyo"), as in the Osedea and HRI 2025 pipelines.
- **Choosing or composing the picture**: pick from a stroke library, or let a model sketch on a coarse grid (SketchAgent style); our code then smooths, scales and plans it deterministically.
- **Seeing the board**: Gemini Robotics-ER pointing to find the board's corners and leftover marks, and a photo check after each drawing, like FRIDA's progress photos.

The pattern has a literature: SayCan (2022), Code as Policies (2022), VoxPoser (2023) and Gemini Robotics-ER all have the model plan and call skills or write code, while separate controllers move the robot.

## 4. The deterministic Fourier pipeline

**Prior art is all on screen.** 3Blue1Brown's "But what is a Fourier series?" (30 Jun 2019, 101 rotating vectors, n from -50 to 50), The Coding Train challenge #130 (Jan 2019, p5.js) and Jez Swanson's interactive introduction (MIT, 2018) made epicycle drawing famous. No open project was found that drives a real plotter or arm from epicycle output (UNVERIFIED that none exists). That is our opening.

**The history is the story.** Fourier published his theory of heat in 1822. Kelvin's tide-predicting machine (1872) was a brass Fourier synthesiser: 10 components summed by a chain over pulleys, a pen plotting "tidal height against time" on moving paper, a year of tides in about 4 hours, the largest component nearest the pen (a brass "sort by magnitude"). Machines of this kind predicted the tides for D-Day in 1944. Michelson's harmonic analyser (1898) had 80 elements and drew its sums with a pen. The harmonograph (mid-1800s) and Spirograph (1965) draw time with pendulums and gears. A 2-link arm whose joints turn at constant rates is itself a 2-term epicycle.

**Why it draws fast.**

- **Pen-up travel dominates plot time.** Evil Mad Scientist: plot time "can actually be dominated... by pen-up movements". Its greedy reordering "can reduce the pen-up travel distance by 50-90% and reduce the plotting time by 30-50%". On one 8,074-glyph map, pen-up was about 87% of all travel (polargraph-optimizer, MIT). One continuous Fourier loop has no pen lifts.
- **Corners cost speed.** Motion controllers slow down for corners: Klipper caps a 90° corner at 5.0 mm/s by default, and GRBL's junction deviation sets its cornering speed. A truncated Fourier series has no corners.
- **The draw time is known before the pen moves** (our own working). For a path z(t) = Σ c_k e^(2πikt/T), speed is at most (2π/T)·Σ|k||c_k| and acceleration at most (2π/T)²·Σk²|c_k|. So under the arm's limits the shortest safe time is T = max(2π·Σ|k||c_k| / v_max, 2π·√(Σk²|c_k| / a_max)). The number of terms N is the dial between detail and seconds. Keep terms by size but cap |k|, because a term's acceleration grows with k².
- **The costs.** Joining contours leaves pen-down bridges (Adneths joins them along a minimum spanning tree and retraces). Sharp corners ring (the Gibbs effect); Lanczos σ-factors damp it. Joint speeds blow up near the edge of the arm's reach, so time the path in joint space (TOPP-RA does this).

**The clock itself barely needs Fourier, which is part of the joke.** A circle is a one-term Fourier series; the hands are straight lines; numerals come from a single-stroke font. Order the path 12, 3, 6, 9 first, because the clinical rubric gives 2 points for it. The full pipeline is for whatever the camera or microphone hands it next.

| Step | What | Library (permissive) |
| --- | --- | --- |
| 1 | Capture a frame or a voice clip | OpenCV (Apache-2.0), sounddevice (MIT) |
| 2 | Edges and contours | scikit-image `canny`, `find_contours` (BSD-3), or vtracer (MIT). Not potrace (GPL) |
| 3 | Join into one path | scipy `cKDTree` greedy nearest neighbour (BSD-3), then OR-Tools TSP (Apache-2.0) or python-tsp (MIT) |
| 4 | Resample by arc length | numpy (BSD-3) |
| 5 | FFT, keep the top N with \|k\| ≤ K, Lanczos σ | `numpy.fft` |
| 6 | Time the path under joint limits | toppra (MIT), or the closed-form bound above |
| 7 | Inverse kinematics | our own closed form; ikpy (Apache-2.0) to check |
| 8 | Motors | pyserial (BSD-3) streaming G-code to GRBL (GPL-3.0 firmware, run unmodified; check the rules), or servo PWM direct |

**Inverse kinematics.** Serial 2-link arm, shoulder at the origin: c₂ = (x²+y²−L₁²−L₂²)/(2L₁L₂), θ₂ = ±acos(c₂), θ₁ = atan2(y,x) − atan2(L₂ sin θ₂, L₁ + L₂ cos θ₂); reachable only when |L₁−L₂| ≤ r ≤ L₁+L₂. Polargraph with motors at (0,0) and (W,0): L_left = √(x²+y²), L_right = √((W−x)²+y²). Plotclock is a five-bar linkage under "cc-by" and Makelangelo's firmware is GPL-2.0: read them, write ours fresh.

**Repos to learn from:** Adneths/fourier-drawer (MIT, Python; SVG, bitmap or video in), trozler/myFourierEpicycles (MIT, JS), MarcPartensky/Fourier (MIT), jasonfyw/fourier-series (MIT, TS), hbldh/pyefd (MIT, elliptic Fourier descriptors). Avoid the GPL ones: Grzetan/ImageToFourierSeries, ftxi/epicycles, George-Ogden/Fourier-Transform.

## 5. Video and voice, for "data and time"

The Fourier transform is the bridge between the time domain and the frequency domain, so every input is a signal over time that the arm redraws as circles.

- **Video becomes one line.** Adneths's "Bad Apple but rendered as a Fourier Series" (Aug 2022, MIT code) traces each frame, joins its contours, starts each frame's loop near the last one's end, and chains all frames into one path. Another version kept only 48 frequencies per frame (2021, no licence). On a whiteboard that is a flip-book where position along the line is time. Live: the camera sees a face or an object, and the arm draws it as one loop.
- **Voice becomes a drawing, and a drawing becomes sound.** The phonautograph (patented 25 Mar 1857) drew sound as a line in soot; a 1860 recording of "Au clair de la lune" was played back in 2008. Oscilloscope music (Jerobeam Fenderson) uses the left and right channels as x and y, so a stereo track draws a picture. Our coefficients can do both: draw your voice's waveform or pitch contour as one loop, then play the same path as XY audio. No plotter that draws a voice spectrogram was found (UNVERIFIED).
- **The time dial.** A slider for N shows the draw time computed before the pen moves. A judge sees detail traded for seconds, live.
- **Kelvin's trick, for HRT.** Fit harmonics to a periodic time series and draw the future, as the tide machines did. This is the forecast plotter (H3) with a 150-year-old precedent.

The model's job in all of these is to hear the request and choose the input; the path, its timing and the motion stay deterministic.

## 6. A benchmark we could beat

Nobody has published a "draw a clock at HH:MM" benchmark with model scores. Reading clocks has benchmarks (ClockBench, Lost in Time), but that is the opposite task. The fair comparisons are the published clinical tests.

| Benchmark | What it measures | Published numbers | Verdict |
| --- | --- | --- | --- |
| Clock Drawing Test on generative AI (Galatzer-Levy et al., Google, arXiv 2410.11756, Oct 2024) | 12 models draw a clock, one try each; image models directly, LLMs via SVG; WMS-IV BCSE rubric, 0 to 15 | Best 14/15 (Gemini Pro 1.5 and GPT-4 Turbo via SVG); GPT-4o 13 direct, 9 via SVG; Gemini Nano 0. Only those two models set the hands to the right time | **Fair and doable tonight.** The rubric is published in full and gives 2 points for drawing 12, 3, 6, 9 first, so order our path that way. One try per model, 2024 models; the paper's prompt and scoring disagree on the time |
| "Age against the machine" (Dayan et al., BMJ 387:e081948, Dec 2024) | The MoCA clock item, "10 past 11": 1 point each for contour, numbers, hands | "None of the large language models completed the entire task successfully" (GPT-4, GPT-4o, Claude 3.5, Gemini 1 and 1.5) | **Fair and doable.** Old models, and the BMJ's Christmas issue |
| Human speed norm (Davoudi et al., J Alzheimers Dis 2021, 430 adults aged 55+) | Time to draw the clock to command (10 past 11) | Mean 35.02 s (SD 12.52); copying a clock 27.40 s | **Fair** as a human reference |
| The 10:10 failure of image models | Image models drift to 10:10, the watch-advert time | Informal only: a blog (Aug 2026) tested 10 image models at 3:27, two tries each, none fully right | **Motivation only.** Re-run it ourselves |
| StarVector / SVG-Bench fonts subset (CVPR 2025) | Rebuilding an SVG from an image (SSIM, LPIPS, DinoScore) | SSIM: Potrace 0.988, StarVector-8B 0.946, GPT-4-V 0.749. Time per image: VTracer 0.09 s, Potrace 10 s, StarVector-8B 74 s | **Fair but off the demo path.** VTracer is already fast, so speed alone is not news |
| ClockBench (Sep 2025), VLA control rates, AxiDraw speed | Reading clocks; control loop Hz; plotter top speed | ClockBench paper: humans 89.1%, best model 13.3% (Gemini 2.5 Pro); live board 24 Oct 2026: best model 83.3% | **Not fair**: a different task, or a race we would lose (AxiDraw at 380 mm/s) |

**The claim to aim for** (only once we have run it): "Asked for 20 random times, our arm drew 20/20 clocks correct to the minute, in a median X s from request to pen-up. Healthy adults take 35 s; in published tests, no LLM passed the MoCA clock and 2 of 12 models set the hands right. Current image models, same prompt, same blind grading: Y/20."

**What to measure:**

- 20 times from a seeded random generator; the same prompt for every system.
- Score every clock on the MoCA 3-point item and the 15-point WMS-IV rubric, graded blind by someone outside the team.
- Hands correct if the minute hand is within ±6° (one minute) and the hour hand within about ±5° of 30h + 0.5m degrees; angles measured from photos of the board.
- Arm time runs from the request to pen-up, including path planning; 10 timed runs, median and range, plus the drawing's size.
- Re-run current image models ourselves on the same 20 times, since the published model scores are from 2024.

**The judge's caveat to answer first:** "a calculator beating a poet at arithmetic." The arm has clock geometry built in. The answer is the thesis: for a job with a right answer, the model should choose and code should draw, and that is faster, exact and repeatable.

## 7. What the pitch must say is new

| Existing thing | What ours does that it doesn't |
| --- | --- |
| Plotclock, Doodle Clock, Whiteboard Clock | Answers you: voice and video in, decides what to draw, then draws the clock as the opening joke rather than the whole product |
| iBoardbot, Joto, Scribit | Fast and exact from a single smooth path, erases on an ordinary whiteboard, and is still working |
| SketchAgent, FRIDA, Osedea's Spot | Keeps the model out of the motion loop, but also replaces image-then-trace with a Fourier path that has a detail-for-time dial |
| Fourier epicycle videos (3Blue1Brown, Coding Train, Bad Apple) | Leaves the screen: the same maths moves a real pen, with its draw time computed in advance |
| Image models drawing clocks | Correct to the minute, every time, scored on a clinical rubric |

## Sources

- Clocks: makezine.com/article/craft/artbot-clock-draws-the-time/ · hackaday.io/project/7930-doodle-clock-2 · elektormagazine.com/news/plotclock-writes-the-time- · courses.ece.cornell.edu/ece5990/ECE5725_Fall2019_Projects/Dec_10_Demo/Pi%20Clock/rd568_wf227_Thursday/index.html · hackaday.com/2015/02/23/whiteboard-clock/ · en.wikipedia.org/wiki/Real_Time_(art_series)
- Whiteboard robots: spectrum.ieee.org/the-iboardbot-brings-xy-plotters-into-the-cloud-age · dezeen.com/2017/03/14/joto-drawing-robot-etch-sketch-digital-age-those-design-products/ · inverse.com/article/50506-scribit-art-robot-draws-on-walls
- Plotters and arms: shop.evilmadscientist.com/productsmenu/846 · evilmadscientist.com/forums/users/windell_oskay/replies/page/35 · scan.co.uk (Dobot) · robotshop.com (DexArm) · mouser.com (uArm datasheet) · marginallyclever.com forum
- Portrait robots: ispr.info/2012/11/27/his-sketching-robots-saved-his-sanity-and-tell-us-how-we-relate-emotionally-to-machines/ · africanews.com/2022/04/05/uk-a-humanoid-robot-paints-portraits/ · cmu.edu FRIDA news · arxiv.org/abs/2210.00664 · arxiv.org/abs/2402.13442 · arxiv.org/abs/2005.05526 · picturemosaics.com/blog/sketchbot_iaapa_2023
- Markets: fox10phoenix.com (Handwrytten) · mydoorsign.com (Bond, secondary) · truscribe.com/feeds/blog/explainer-video-cost · pmc.ncbi.nlm.nih.gov/articles/PMC6713325/
- AI drawing: arxiv.org/abs/2411.17673 · arxiv.org/abs/1704.03477 · osedea.com/insight/making-spot-draw-anything-with-diffusion-and-gcode · smus.com/exupery · deeplocal.com/google-poster-maker · luma.com/ni360mav
- Model APIs and latency: ai.google.dev/gemini-api/docs/robotics-overview · developers.googleblog.com (Gemini Robotics-ER 1.5) · deepmind.google/models/model-cards/gemini-robotics-on-device-2/ · arxiv.org/abs/2503.20020 · pi.website/blog/pi0 · github.com/Physical-Intelligence/openpi · huggingface.co/nvidia/GR00T-N1.6-3B · artificialanalysis.ai/speech-to-speech · docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/send-audio-video-streams · docs.openmv.io (servos) · github.com/gnea/grbl
- Precision and repeatability: arxiv.org/abs/2505.09990 · arxiv.org/abs/2407.06581 · arxiv.org/abs/2604.04192 · thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference
- Plan, then execute: arxiv.org/abs/2204.01691 · arxiv.org/abs/2209.07753 · arxiv.org/abs/2307.05973
- Fourier and history: youtube.com/watch?v=r6sGWTCMz2k · 3blue1brown.com/lessons/fourier-series · thecodingtrain.com/challenges/130-drawing-with-fourier-transform-and-epicycles · jezzamon.com/fourier/ · collection.sciencemuseumgroup.org.uk/objects/co53901 · en.wikipedia.org/wiki/Tide-predicting_machine · engineerguy.com/fourier/ · en.wikipedia.org/wiki/Fast_Fourier_transform · en.wikipedia.org/wiki/Sigma_approximation
- Plot speed: evilmadscientist.com/page/10/ · axidraw.com/doc/py_api/ · github.com/ezheidtmann/polargraph-optimizer · github.com/gnea/grbl/wiki/Grbl-v1.1-Configuration · klipper3d.org/Config_Reference.html · TOPP-RA (Pham and Pham, IEEE T-RO 2018)
- Video and sound: github.com/Adneths/fourier-drawer · hackaday.com (Sprite_TM Vectrex Bad Apple, Apr 2015) · oscilloscopemusic.com · en.wikipedia.org/wiki/Phonautograph · mathshistory.st-andrews.ac.uk/Biographies/Lissajous/
- Inverse kinematics: github.com/9a/plotclock · Makelangelo firmware src/robots/polargraph.cpp
- Benchmarks: arxiv.org/abs/2410.11756 · bmj.com/content/387/bmj-2024-081948 · pmc.ncbi.nlm.nih.gov/articles/PMC8379638 · arxiv.org/abs/2605.16386 · clockbench.ai · arxiv.org/abs/2502.05092 · polymath07.blogspot.com/2026/08/getting-clocks-right-ai-almost-there.html · arxiv.org/abs/2312.11556 · arxiv.org/abs/2504.06263
