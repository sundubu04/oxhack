#!/usr/bin/env python3
"""Cuts recorded takes into the demo video, from a running order in edit.json.

    python3 cut.py demo/edit.json --out demo/out/demo.mp4 [--small 9.5]

Each item in "order" is a clip between two marks of a take (with a speed, an optional caption and a
hold on its last frame) or a card (a title on a plain page). Clips are resampled by timestamp onto
a constant frame rate, so a long take never drifts. Speed-ups get a ▶▶ badge and no number. Clicks,
fields and frames logged with a zoom get an eased zoom, only in clips at 1.6x or slower. Text is
drawn with PIL, because Homebrew's ffmpeg has no drawtext. Needs ffmpeg and Pillow.
"""
import argparse
import bisect
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

EASE = 0.7       # seconds to ease a zoom in or out
GAP = 1.5        # least time between two zooms
HOLD = 1.2       # how long a click zoom stays after the click
MAX_ZOOM_SPEED = 1.6

FONTS = [
    "/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/segoeui.ttf",
]


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def font(path, size):
    for p in ([path] if path else []) + FONTS:
        if p and os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


class Take:
    """One recording folder: frames with timestamps, and the marks and clicks logged with them."""

    def __init__(self, folder):
        self.folder = folder
        self.meta = json.load(open(os.path.join(folder, "meta.json")))
        rows = [json.loads(l) for l in open(os.path.join(folder, "frames.jsonl")) if l.strip()]
        rows.sort(key=lambda r: r["t"])
        if not rows:
            sys.exit("%s has no frames" % folder)
        self.times = [r["t"] for r in rows]
        self.files = [os.path.join(folder, r["file"]) for r in rows]
        self.events = [json.loads(l) for l in open(os.path.join(folder, "events.jsonl")) if l.strip()]
        self.marks = {}
        for e in self.events:
            if e["kind"] == "mark":
                self.marks.setdefault(e["name"], e["t"])
        self._cache = (None, None)

    def at(self, name):
        if name in (None, "start"):
            return self.times[0]
        if name == "end":
            return self.times[-1]
        if name not in self.marks:
            sys.exit("%s has no mark %r (marks: %s)" % (self.folder, name, ", ".join(self.marks)))
        return self.marks[name]

    def frame(self, t):
        """The last frame shown at time t (the screencast only sends frames when something changes)."""
        i = max(0, bisect.bisect_right(self.times, t) - 1)
        if self._cache[0] != i:
            self._cache = (i, Image.open(self.files[i]).convert("RGB"))
        return self._cache[1]


def zooms_for(take, t0, t1, speed):
    """Zoom windows in output seconds: (rise start, full, fall start, end, zoom, box)."""
    if speed > MAX_ZOOM_SPEED:
        return []
    out, last_end = [], -1e9
    for e in take.events:
        z = e.get("zoom") or 0
        if e["kind"] not in ("click", "type", "emph") or z <= 1 or not (t0 <= e["t"] <= t1):
            continue
        te = (e["t"] - t0) / speed
        length = (t1 - t0) / speed
        if e["kind"] == "click":
            full, fall = te, te + HOLD
        else:  # a field being typed into, or an element framed on purpose
            full, fall = te, te + max(HOLD, (e.get("dur") or 0) / speed)
        rise = max(0.0, full - EASE)
        full = rise + min(EASE, full - rise) if full > rise else rise
        end = min(length, fall + EASE)
        if rise < last_end + GAP and out:
            continue  # too close to the last zoom; one steady zoom reads better than two jumps
        out.append((rise, full, min(fall, end), end, z, e["box"]))
        last_end = end
    return out


def zoomed(img, t, windows, scale, size):
    """Crop the frame towards the zoom target active at output time t, then fit it to the output size."""
    W, H = img.size
    k, cx, cy = 1.0, W / 2, H / 2
    for rise, full, fall, end, z, box in windows:
        if rise <= t <= end:
            if t < full:
                e = ease((t - rise) / max(1e-6, full - rise))
            elif t <= fall:
                e = 1.0
            else:
                e = 1 - ease((t - fall) / max(1e-6, end - fall))
            bx = (box["x"] + box["width"] / 2) * scale
            by = (box["y"] + box["height"] / 2) * scale
            # a wide box (a field) caps the zoom so the whole box stays in frame
            fit = min(z, W / max(1.0, box["width"] * scale * 1.3))
            k = 1 + (max(1.0, fit) - 1) * e
            cx, cy = W / 2 + (bx - W / 2) * e, H / 2 + (by - H / 2) * e
            break
    if k <= 1.001 and img.size == size:
        return img
    cw, ch = W / k, H / k
    left = min(max(0.0, cx - cw / 2), W - cw)
    top = min(max(0.0, cy - ch / 2), H - ch)
    return img.resize(size, Image.LANCZOS, box=(left, top, left + cw, top + ch))


def badge(img, theme):
    """The ▶▶ mark for a sped-up clip, drawn as two triangles (no font needed)."""
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    u = H / 1080
    x1, y0 = W - 48 * u, 40 * u
    w, h = 104 * u, 56 * u
    ink = hex_rgb(theme["ink"])
    d.rounded_rectangle((x1 - w, y0, x1, y0 + h), radius=h / 2, fill=ink + (205,))
    tw, th = 22 * u, 26 * u
    sx = x1 - w / 2 - tw
    for i in (0, 1):
        x = sx + i * tw
        d.polygon([(x, y0 + (h - th) / 2), (x + tw, y0 + h / 2), (x, y0 + (h + th) / 2)], fill=(255, 255, 255, 255))
    return img


def caption(img, text, theme, fnt):
    """A one-line caption on the footage, bottom left."""
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    u = H / 1080
    pad, x, y = 22 * u, 64 * u, H - 64 * u
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    w, h = r - l, b - t
    d.rounded_rectangle((x, y - h - 2 * pad, x + w + 2 * pad, y), radius=14 * u, fill=hex_rgb(theme["ink"]) + (215,))
    d.text((x + pad - l, y - h - pad - t), text, font=fnt, fill=(255, 255, 255, 255))
    return img


def wrap(d, text, fnt, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if d.textlength(trial, font=fnt) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def card(size, title, sub, theme, title_font, sub_font):
    """A plain page with a left-aligned title and an optional line under it."""
    W, H = size
    u = H / 1080
    img = Image.new("RGB", size, hex_rgb(theme["bg"]))
    d = ImageDraw.Draw(img)
    x, width = 160 * u, W - 320 * u
    lines = wrap(d, title, title_font, width)
    lh = title_font.size * 1.18
    sub_lines = wrap(d, sub, sub_font, width) if sub else []
    sh = sub_font.size * 1.35
    total = lh * len(lines) + (28 * u + sh * len(sub_lines) if sub_lines else 0)
    y = (H - total) / 2
    for line in lines:
        d.text((x, y), line, font=title_font, fill=hex_rgb(theme["ink"]))
        y += lh
    if sub_lines:
        y += 28 * u
        for line in sub_lines:
            d.text((x, y), line, font=sub_font, fill=hex_rgb(theme["muted"]))
            y += sh
    return img


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("edit")
    ap.add_argument("--out", default=None)
    ap.add_argument("--small", type=float, default=0, help="also write a copy under this many MB")
    args = ap.parse_args()

    base = os.path.dirname(os.path.abspath(args.edit))
    edit = json.load(open(args.edit))
    fps = edit.get("fps", 30)
    size = tuple(edit.get("size", [1920, 1080]))
    theme = {"bg": "#fcfbfb", "ink": "#1f1a1d", "muted": "#5f575b"}
    theme.update(edit.get("theme", {}))
    u = size[1] / 1080
    title_font = font(edit.get("font"), int(68 * u))
    sub_font = font(edit.get("font"), int(36 * u))
    cap_font = font(edit.get("font"), int(38 * u))
    takes = {k: Take(os.path.join(base, v)) for k, v in edit["takes"].items()}
    out = args.out or os.path.join(base, "out", "demo.mp4")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)

    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", "%dx%d" % size, "-r", str(fps), "-i", "-",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                           "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    timeline, clock = [], 0.0

    def emit(img, n=1):
        raw = img.tobytes()
        for _ in range(n):
            ff.stdin.write(raw)

    for item in edit["order"]:
        start = clock
        if "card" in item:
            img = card(size, item["card"], item.get("sub"), theme, title_font, sub_font)
            n = int(round(item.get("dur", 2.5) * fps))
            emit(img, n)
            clock += n / fps
            timeline.append({"at": round(start, 2), "card": item["card"], "dur": round(n / fps, 2)})
            continue
        take = takes[item["clip"]]
        speed = float(item.get("speed", 1))
        t0, t1 = take.at(item.get("from")), take.at(item.get("to"))
        if t1 <= t0:
            sys.exit("clip %s: %r comes after %r" % (item["clip"], item.get("from"), item.get("to")))
        scale = take.frame(t0).size[0] / take.meta["width"]
        windows = zooms_for(take, t0, t1, speed) if item.get("zoom", True) else []
        n = int(round((t1 - t0) / speed * fps))
        img = None
        for k in range(n):
            t_out = k / fps
            img = zoomed(take.frame(t0 + t_out * speed), t_out, windows, scale, size)
            if img is take.frame(t0 + t_out * speed):
                img = img.copy()
            if speed > 1.05:
                badge(img, theme)
            if item.get("caption"):
                caption(img, item["caption"], theme, cap_font)
            emit(img)
        clock += n / fps
        if item.get("hold") and img is not None:
            last = zoomed(take.frame(t1), (t1 - t0) / speed, windows, scale, size).copy()
            if item.get("caption"):
                caption(last, item["caption"], theme, cap_font)
            h = int(round(item["hold"] * fps))
            emit(last, h)
            clock += h / fps
        timeline.append({"at": round(start, 2), "clip": item["clip"], "from": item.get("from"), "to": item.get("to"),
                         "speed": speed, "dur": round(clock - start, 2), "zooms": len(windows)})

    ff.stdin.close()
    if ff.wait() != 0:
        sys.exit("ffmpeg failed")
    json.dump({"out": out, "duration": round(clock, 2), "timeline": timeline}, open(out + ".json", "w"), indent=2)
    print("%s  %.1f s" % (out, clock))
    for row in timeline:
        print("  %6.2f  %s" % (row["at"], row.get("card") or "%s %s → %s at %sx" % (row["clip"], row["from"], row["to"], row["speed"])))

    if args.small:
        small = out.replace(".mp4", "-small.mp4")
        kbps = int(args.small * 8 * 1024 * 0.92 / max(1.0, clock))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", out, "-c:v", "libx264", "-b:v", "%dk" % kbps,
                        "-maxrate", "%dk" % int(kbps * 1.4), "-bufsize", "%dk" % (kbps * 2), "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", small], check=True)
        print("%s  %.1f MB" % (small, os.path.getsize(small) / 1048576))


if __name__ == "__main__":
    main()
