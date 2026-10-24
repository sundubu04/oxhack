#!/usr/bin/env python3
"""The hackathon clock: how long until the freeze, the submission and the pitch.

Reads the five lines at the top of hack/event.md. With --line it prints one short line for the
status bar; without it, it prints the note a session starts with (the clock, the phase, where the
plan lives) and turns on the repo's git hooks if they are off.
"""
import datetime as dt
import os
import subprocess
import sys

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def read_event():
    """The front matter of hack/event.md as a dict of strings; empty when the file is missing."""
    path = os.path.join(ROOT, "hack", "event.md")
    try:
        lines = open(path, encoding="utf-8").read().split("\n")
    except OSError:
        return {}
    if not lines or lines[0].strip() != "---":
        return {}
    out = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.lstrip().startswith("#") or ":" not in line:
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip()
    return out


def zone(name):
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(name)
    except Exception:
        return None  # no tz database (Windows without tzdata): treat times as this machine's


def when(text, tz):
    """'2026-11-14 09:00' as an aware datetime in the event's zone, or None."""
    try:
        t = dt.datetime.strptime(text, "%Y-%m-%d %H:%M")
    except (TypeError, ValueError):
        return None
    return t.replace(tzinfo=tz) if tz else t.astimezone()


def span(delta):
    """A time left as '2 h 05 min', '45 min' or '1 d 3 h'."""
    mins = int(delta.total_seconds() // 60)
    if mins < 60:
        return "%d min" % mins
    hours, mins = divmod(mins, 60)
    if hours < 24:
        return "%d h %02d min" % (hours, mins)
    days, hours = divmod(hours, 24)
    return "%d d %d h" % (days, hours)


def phase(now, times):
    """The phase from the clock and from what exists in the repo."""
    if os.path.exists(os.path.join(ROOT, ".freeze")):
        return "frozen for the demo"
    if times.get("pitch") and now >= times["pitch"]:
        return "wrap-up"
    if times.get("submit") and now >= times["submit"]:
        return "pitch"
    if times.get("start") and now < times["start"]:
        return "before the start"
    if os.path.exists(os.path.join(ROOT, "docs", "spec-plan.md")):
        return "build"
    ideas = os.path.join(ROOT, "hack", "ideas.md")
    try:
        has_ideas = "\n| 1 |" in open(ideas, encoding="utf-8").read()
    except OSError:
        has_ideas = False
    return "ideate" if has_ideas else "kickoff"


def clock():
    event = read_event()
    tz = zone(event.get("tz") or "Europe/London")
    now = dt.datetime.now(tz) if tz else dt.datetime.now().astimezone()
    times = {k: when(event.get(k), tz) for k in ("start", "freeze", "submit", "pitch")}
    times = {k: v for k, v in times.items() if v}
    ahead = []
    for key, label in (("start", "start"), ("freeze", "freeze"), ("submit", "submission"), ("pitch", "pitch")):
        t = times.get(key)
        if t and t > now:
            ahead.append((label, t - now, t))
    return event.get("name") or "OxHack", now, times, ahead, phase(now, times)


def status_line():
    name, now, times, ahead, ph = clock()
    if not times:
        return "%s · times not set (oxh-kickoff)" % name
    bits = ["%s %s" % (span(d), label) for label, d, _ in ahead[:2]]
    return " · ".join([name] + bits + [ph])


def git_hooks_note():
    """Point git at .githooks once per clone, so the pre-commit guard runs for everyone."""
    try:
        cur = subprocess.run(["git", "-C", ROOT, "config", "--get", "core.hooksPath"],
                             capture_output=True, text=True, timeout=5).stdout.strip()
        if cur == ".githooks" or not os.path.isdir(os.path.join(ROOT, ".githooks")):
            return ""
        if cur:
            return "Git hooks point at %s, not .githooks, so the pre-commit guard is off." % cur
        subprocess.run(["git", "-C", ROOT, "config", "core.hooksPath", ".githooks"], timeout=5)
        return "Turned on the repo's pre-commit guard (git config core.hooksPath .githooks)."
    except Exception:
        return ""


def session_note():
    name, now, times, ahead, ph = clock()
    out = []
    if not times:
        out.append("%s: the event times are not set yet. Run oxh-kickoff with the organisers' brief to fill in hack/event.md." % name)
    else:
        left = ", ".join("%s to the %s (%s)" % (span(d), label, t.strftime("%a %H:%M")) for label, d, t in ahead)
        out.append("%s, now %s. %s. Phase: %s." % (name, now.strftime("%a %d %b %H:%M"), left or "Every deadline has passed", ph))
    if ph == "frozen for the demo":
        out.append("The demo freeze is on: app code is read-only until someone runs rm .freeze.")
    out.append("Read hack/event.md (rules, judging) and CLAUDE.md before deciding anything; the plan is docs/spec-plan.md once it exists.")
    note = git_hooks_note()
    if note:
        out.append(note)
    return "\n".join(out)


if __name__ == "__main__":
    try:
        print(status_line() if "--line" in sys.argv else session_note())
    except Exception as exc:  # a broken clock must never block a session
        print("OxHack clock error: %s" % exc)
