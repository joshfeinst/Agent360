#!/usr/bin/env bash
# Every shipped version gets a git tag, so `git tag` is the release list and
# `git show v1.54:index.html` is that build. Rebuilt from history rather than
# kept by hand: each tag points at the first commit reachable from main whose
# index.html carries that VERSION, preferring the merge commit that landed it.
# Idempotent — existing tags are left alone. Pass --push to publish them.
set -u   # not pipefail-strict: `git show | grep -m1` exits on SIGPIPE by design
cd "$(dirname "$0")/.."
remote=${REMOTE:-origin}
git fetch -q "$remote" main 2>/dev/null || true

# The release line, however this clone is checked out: a CI runner may hold no
# remote-tracking ref, only what the fetch above left in FETCH_HEAD.
base=$(git rev-parse -q --verify "$remote/main" \
    || git rev-parse -q --verify FETCH_HEAD \
    || git rev-parse -q --verify main \
    || git rev-parse HEAD)

pick() {  # version -> commit, first-parent (the release point) wins
  git rev-list --reverse --first-parent "$base"
  git rev-list --reverse --topo-order "$base"
}
declare -A seen=()
while read -r c; do
  v=$(git show "$c:index.html" 2>/dev/null | { grep -m1 -oP "const VERSION = '\K[0-9.]+" || true; })
  [ -n "$v" ] || continue
  [ -n "${seen[$v]:-}" ] && continue
  seen[$v]=$c
done < <(pick)

made=0
for v in $(printf '%s\n' "${!seen[@]}" | sort -V); do
  t="v$v"; c=${seen[$v]}
  git rev-parse -q --verify "refs/tags/$t" >/dev/null && continue
  # the headline, without the plumbing: the merge prefix, a leading version or
  # version range, and a trailing PR number are all noise in a tag message
  subj=$(git log -1 --format=%s "$c" \
    | sed -E 's/^Merge [^\xe2]*\xe2\x80\x94 //; s/^Agent 360 //; s/^v[0-9.]+(-v[0-9.]+)?( \xe2\x80\x94|:)? *//; s/ \(#[0-9]+\)$//')
  git tag -a "$t" -m "Agent 360 $t — ${subj}" "$c"
  made=$((made+1))
done
echo "tags: $(git tag | wc -l) total, $made new"

# every tag must actually carry its own version, in both files and the marker
bad=0
while read -r t; do
  hv=$(git show "$t:index.html" | { grep -m1 -oP "const VERSION = '\K[0-9.]+" || true; })
  sv=$(git show "$t:sw.js" | { grep -m1 -oP "agent360-v\K[0-9.]+" || true; })
  [ "v$hv" = "$t" ] && [ "$hv" = "$sv" ] || { echo "MISMATCH $t index=$hv sw=$sv"; bad=1; }
done < <(git tag)
[ "$bad" = 0 ] && echo "every tag carries its own version"

if [ "${1:-}" = "--push" ]; then
  git push "$remote" --tags
fi
