#!/usr/bin/env python3
"""Refuses edits to app code while .freeze exists at the repo root (the demo freeze).

Runs before Edit, Write and NotebookEdit. The demo, the pitch, the docs and the hack notes stay
editable; everything else in the repo is frozen. Edits made through Bash are not caught.
"""
import json
import os
import sys

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
OPEN = ("hack/", "docs/", "demo/", "pitch/", ".claude/", "README.md", "CLAUDE.md")


def main():
    if not os.path.exists(os.path.join(ROOT, ".freeze")):
        return
    try:
        call = json.load(sys.stdin)
    except ValueError:
        return
    args = call.get("tool_input") or {}
    path = args.get("file_path") or args.get("notebook_path") or ""
    if not path:
        return
    full = os.path.realpath(os.path.join(ROOT, path))
    root = os.path.realpath(ROOT)
    if not full.startswith(root + os.sep):
        return  # outside the repo: not ours to freeze
    rel = os.path.relpath(full, root).replace(os.sep, "/")
    if rel.startswith(OPEN) or rel == ".freeze":
        return
    why = ""
    try:
        why = open(os.path.join(ROOT, ".freeze"), encoding="utf-8").read().strip()
    except OSError:
        pass
    reason = ("The demo freeze is on%s, so app code (%s) is read-only. Demo, pitch, docs and hack notes "
              "stay editable. If this change must go in, ask the team, then lift the freeze with rm .freeze."
              % (" (" + why + ")" if why else "", rel))
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                             "permissionDecision": "deny",
                                             "permissionDecisionReason": reason}}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # never block a session because the hook itself broke
