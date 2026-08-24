#!/usr/bin/env bash
# install-hooks.sh — copy this repo's pre-commit hook into your clone.
#
# Run it yourself, on purpose:
#
#     scripts/install-hooks.sh
#
# 🔵 Why this is a script you run, and not something `npm install` does for you:
#    a hook that appears in your repo without you asking is a surprise, and a
#    surprise that runs on every commit. Installing it is your decision.
#
# 🔵 Why the hook is not simply committed into .git/hooks: git does not clone that
#    directory. That is a deliberate git safety property — cloning a repo must not
#    execute code the author chose. So the hook ships as a normal file under
#    scripts/, and this installer copies it. There is no way around the copy, and
#    there should not be.
#
# What the hook does: refuses commits containing local-only paths, runtime/login
# state, build junk, or credential-shaped strings — see scripts/pre-commit.
#
# 🔴 It is offered, not required. If you do not run an agent harness in this tree,
#    most of what it guards will never appear and it will simply stay quiet.

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "❌ Not inside a git repository." >&2
  exit 1
}

src="$repo_root/scripts/pre-commit"
[ -f "$src" ] || { echo "❌ Missing $src" >&2; exit 1; }

# 🔴 Deliberately NOT touching core.hooksPath. If you already point it somewhere,
#    that is your setup and silently redirecting it would break your workflow.
hooks_dir=$(git rev-parse --git-path hooks)
mkdir -p "$hooks_dir"
dest="$hooks_dir/pre-commit"

if [ -e "$dest" ]; then
  if cmp -s "$src" "$dest"; then
    echo "✅ Already installed and identical — nothing to do."
    exit 0
  fi
  # 🔴 Never overwrite. A hook you did not write may be doing something you need.
  echo "🔴 A different pre-commit hook is already installed:" >&2
  echo "     $dest" >&2
  echo "" >&2
  echo "   Not overwriting it. Compare them and merge by hand if you want both:" >&2
  echo "     diff \"$dest\" \"$src\"" >&2
  exit 1
fi

cp "$src" "$dest"
chmod +x "$dest"

echo "✅ Installed pre-commit hook → $dest"
echo ""
echo "   Test it without committing anything:"
echo "     git commit --dry-run --allow-empty -m test"
echo "   Bypass it deliberately on a single commit:"
echo "     git commit --no-verify"
