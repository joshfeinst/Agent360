#!/usr/bin/env bash
# Publish every shipped version as a git tag AND a GitHub Release.
#
#   GH_TOKEN=<token with contents:write> bash tools/publish-releases.sh
#
# Idempotent: tags and releases that already exist are left alone, so it is
# safe to re-run after each release. The body of each release is that version's
# section of CHANGELOG.md, which tools/changelog.py builds from the tag
# headline and README.md — nothing is written by hand twice.
#
# Needs a credential that may write refs/tags/*. A session token scoped to
# branches answers a bare "HTTP 403" to the tag push and gets no further.
set -u
cd "$(dirname "$0")/.."
remote=${REMOTE:-origin}
repo=${REPO:-joshfeinst/Agent360}
token=${GH_TOKEN:-${GITHUB_TOKEN:-}}

bash tools/tag-releases.sh || exit 1
[ -f CHANGELOG.md ] || python3 tools/changelog.py

echo "== pushing tags to $remote"
if ! git push "$remote" --tags; then
  echo "!! the remote refused the tag push — a release cannot exist without its tag." >&2
  echo "   Run this from a clone whose credential may write refs/tags/*." >&2
  exit 1
fi

[ -n "$token" ] || { echo "!! set GH_TOKEN to create the releases themselves" >&2; exit 1; }

api() { curl -sS -H "Authorization: Bearer $token" \
              -H "Accept: application/vnd.github+json" \
              -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

# oldest first, so the newest version ends up flagged as the latest release
made=0
for tag in $(git tag | sort -V); do
  code=$(api -o /dev/null -w '%{http_code}' "https://api.github.com/repos/$repo/releases/tags/$tag")
  if [ "$code" = "200" ]; then continue; fi
  head=$(git for-each-ref --format='%(contents:subject)' "refs/tags/$tag" | sed -E 's/^Agent 360 //')
  body=$(python3 - "$tag" <<'PY'
import re, sys, pathlib
tag = sys.argv[1]
text = pathlib.Path('CHANGELOG.md').read_text(encoding='utf-8')
m = re.search(r'^## ' + re.escape(tag) + r' — [^\n]*\n(.*?)(?=^## v|\Z)', text, re.M | re.S)
print((m.group(1).strip() if m else '').strip())
PY
)
  payload=$(python3 - "$tag" "$head" "$body" <<'PY'
import json, sys
print(json.dumps({'tag_name': sys.argv[1], 'name': sys.argv[2],
                  'body': sys.argv[3], 'draft': False, 'prerelease': False}))
PY
)
  code=$(api -o /tmp/rel.json -w '%{http_code}' -X POST \
            "https://api.github.com/repos/$repo/releases" -d "$payload")
  if [ "$code" = "201" ]; then made=$((made+1)); echo "  published $tag"
  else echo "  FAILED $tag (HTTP $code): $(head -c 200 /tmp/rel.json)" >&2; fi
done
echo "== $made new release(s); $(git tag | wc -l) versions tagged"
