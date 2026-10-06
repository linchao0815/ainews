r"""Mirror Claude auto-memory into <repo>/memory/ (run from a Claude Code Stop hook).

Source: ~/.claude/projects/<slug>/memory/  where <slug> is derived from the repo root
(`S:\AI\h5protect` -> `s--AI-h5protect`; `_` also becomes `-`,
so `S:\AI\LLM_Evernote` -> `s--AI-LLM-Evernote`). Copies every *.md into the mirror.
Silent on no-op; never fails the hook.

Two things the mirror must never do (both found by cross-model review, 2026-10-06):

- Prune what this machine never mirrored. On a fresh machine (or a wiped ~/.claude)
  the source holds one new file while the repo's memory/ holds the whole history;
  "delete what the source lacks" would wipe it. So pruning only removes files that
  THIS machine mirrored before and whose source is now gone, tracked in a local
  manifest next to the source (never in the repo, so a clone starts with none).
- Overwrite MEMORY.md with a partial index. A fresh machine or a worktree session
  has an index of a few lines; copying it over the repo's index drops every other
  entry. MEMORY.md is merged instead: the source's lines, then the mirror's lines
  for memory files the source doesn't list and that still exist in the mirror.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys

INDEX = "MEMORY.md"
MANIFEST = "memory-sync.json"
LINK = re.compile(r"\]\(([^)]+\.md)\)")


def slug(root: pathlib.Path) -> str:
    s = str(root).replace("\\", "/")
    s = re.sub(r"^([A-Za-z]):", lambda m: m.group(1).lower() + "-", s)
    return re.sub(r"[/:_]", "-", s)


def main_repo_root(here: pathlib.Path) -> pathlib.Path:
    """Resolve the main checkout even when run from a linked worktree.

    A Stop hook fired inside .claude/worktrees/<x>/ has that worktree as cwd; its
    memory slug points at a per-worktree dir and the mirror would land in the
    worktree, not the main repo. `--git-common-dir` is the shared .git of the main
    checkout; its parent is the main root. Falls back to `here` when git is absent.
    """
    try:
        out = subprocess.run(
            ["git", "-C", str(here), "rev-parse", "--git-common-dir"],
            capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout.strip()
        common = pathlib.Path(out)
        if not common.is_absolute():
            common = (here / common).resolve()
        return common.parent
    except Exception:
        return here


def _lines(path: pathlib.Path) -> list:
    if not path.exists():
        return []
    return path.read_bytes().decode("utf-8").splitlines()


def merge_index(src_lines: list, dst_lines: list, existing: set) -> list:
    """The source index, plus mirror lines for files the source doesn't list.

    A mirror line is kept only if it links a memory file that still exists in the
    mirror (so an entry whose file was pruned goes with it). Lines without a link
    (headers, blanks) come from the source only.
    """
    listed = {m.group(1) for line in src_lines for m in LINK.finditer(line)}
    out = list(src_lines)
    for line in dst_lines:
        links = [m.group(1) for m in LINK.finditer(line)]
        if links and not any(t in listed for t in links) and all(t in existing for t in links):
            out.append(line)
            listed.update(links)
    return out


def sync(src: pathlib.Path, dst: pathlib.Path, manifest: pathlib.Path, prune: bool) -> list:
    """Mirror src/*.md into dst; returns the changes as ['+name', '-name', ...]."""
    dst.mkdir(exist_ok=True)
    changed = []
    names = {p.name for p in src.glob("*.md")}
    for p in sorted(src.glob("*.md")):
        if p.name == INDEX:
            continue
        q = dst / p.name
        if not q.exists() or q.read_bytes() != p.read_bytes():
            shutil.copyfile(p, q)
            changed.append("+" + p.name)

    if prune:
        try:
            before = set(json.loads(manifest.read_text(encoding="utf-8")))
        except Exception:
            before = set()
        for name in sorted(before - names):
            q = dst / name
            if name != INDEX and q.exists():
                q.unlink()
                changed.append("-" + name)
        manifest.write_text(json.dumps(sorted(names), ensure_ascii=False), encoding="utf-8")

    if INDEX in names:
        existing = {q.name for q in dst.glob("*.md")}
        merged = merge_index(_lines(src / INDEX), _lines(dst / INDEX), existing)
        text = "\n".join(merged) + "\n"
        q = dst / INDEX
        if not q.exists() or q.read_bytes() != text.encode("utf-8"):
            q.write_bytes(text.encode("utf-8"))
            changed.append("+" + INDEX)
    return changed


def main() -> int:
    here = pathlib.Path(__file__).resolve().parent.parent
    root = main_repo_root(here)
    projects = pathlib.Path.home() / ".claude" / "projects"
    # Read from the worktree's own slug first (that's where this session writes),
    # then the main slug; the mirror always goes to the main repo's memory/.
    srcs = [projects / slug(here) / "memory"]
    if root != here:
        srcs.append(projects / slug(root) / "memory")
    srcs = [s for s in srcs if s.is_dir() and any(s.glob("*.md"))]
    if not srcs:
        return 0
    src = srcs[0]
    # Only prune when mirroring the main slug: a worktree slug holds a partial set
    # and must not delete memories that belong to the main session.
    changed = sync(src, root / "memory", src.parent / MANIFEST, prune=(root == here))
    if changed:
        print("sync_memory:", " ".join(changed))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # never block the Stop hook
        print("sync_memory error:", e)
        sys.exit(0)
