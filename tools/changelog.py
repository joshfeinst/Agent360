#!/usr/bin/env python3
"""Build CHANGELOG.md — the release notes, one section per shipped version.

Nothing here is written by hand twice: the headline comes from the version's
git tag, the prose from that version's section in README.md. Re-run it after a
release (tools/tag-releases.sh first, so the tag exists) and commit the result;
tools/publish-releases.sh posts these same sections as GitHub Releases.
"""
import re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = 'joshfeinst/Agent360'
PLAY = 'https://joshfeinst.github.io/Agent360/'

def sh(*a):
    return subprocess.run(a, cwd=ROOT, capture_output=True, text=True, check=True).stdout

def vkey(v):
    return tuple(int(p) for p in v.split('.'))

# headline per version, from the annotated tag
tags = {}
for line in sh('git', 'for-each-ref', '--format=%(refname:short)\t%(contents:subject)',
               'refs/tags/').splitlines():
    tag, _, subj = line.partition('\t')
    if not re.fullmatch(r'v[0-9.]+', tag):
        continue
    tags[tag[1:]] = re.sub(r'^Agent 360 v[0-9.]+ — ', '', subj).strip()
if not tags:
    sys.exit('no version tags — run tools/tag-releases.sh first')

# prose per version, from README's own release sections (one heading may name
# two versions that shipped together, e.g. "## v1.22 · v1.23")
readme = (ROOT / 'README.md').read_text(encoding='utf-8')
notes = {}
# split on EVERY heading, then keep the ones that name versions: splitting on
# version headings alone let a neighbouring prose section (README's own
# "## Versions") ride along inside the previous release's notes
parts = re.split(r'^## (.+)$', readme, flags=re.M)
for head, body in zip(parts[1::2], parts[2::2]):
    if not re.fullmatch(r'v[0-9.]+(\s*·\s*v[0-9.]+)*', head.strip()):
        continue
    body = body.strip()
    if not body:
        continue
    for v in re.findall(r'v([0-9.]+)', head):
        notes[v] = body

out = ['# Changelog',
       '',
       f'Every shipped version of Agent 360, newest first. Each is a git tag, so',
       f'`git show v{max(tags, key=vkey)}:index.html` is that exact build; the ledger behind each',
       'entry is [NIGHT_LOG.md](NIGHT_LOG.md).',
       '',
       f'Play the current build: <{PLAY}>',
       '']
for v in sorted(tags, key=vkey, reverse=True):
    out.append(f'## v{v} — {tags[v]}')
    out.append('')
    body = notes.get(v)
    if body:
        # pin the ledger link to this version's tree rather than to main
        body = re.sub(r'\[NIGHT_LOG\.md\]\(NIGHT_LOG\.md\)',
                      f'[NIGHT_LOG.md](https://github.com/{REPO}/blob/v{v}/NIGHT_LOG.md)', body)
        out.append(body)
    else:
        # no README section for this one — the release commit's own body is the
        # next best account of it, trimmed to its first paragraph
        c = sh('git', 'rev-list', '-1', f'v{v}').strip()
        para = sh('git', 'log', '-1', '--format=%b', c).strip().split('\n\n')[0].strip()
        out.append(para or f'{tags[v][0].upper()}{tags[v][1:]}.')
    out.append('')

(ROOT / 'CHANGELOG.md').write_text('\n'.join(out).rstrip() + '\n', encoding='utf-8')
print(f'CHANGELOG.md — {len(tags)} versions, {sum(1 for v in tags if v in notes)} with notes')
