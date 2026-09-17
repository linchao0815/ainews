"""Mirror Claude auto-memory into <repo>/memory/ (run from a Claude Code Stop hook).

Source: ~/.claude/projects/<slug>/memory/  where <slug> is derived from the repo root
(`S:\\AI\\h5protect` -> `s--AI-h5protect`; `_` also becomes `-`,
so `S:\AI\LLM_Evernote` -> `s--AI-LLM-Evernote`). Copies every *.md (incl. MEMORY.md), removes
mirrored files whose source is gone. Silent on no-op; never fails the hook.
"""
import pathlib
import re
import shutil
import subprocess
import sys


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
    dst = root / "memory"
    dst.mkdir(exist_ok=True)
    changed = []
    names = {p.name for p in src.glob("*.md")}
    for p in src.glob("*.md"):
        q = dst / p.name
        if not q.exists() or q.read_bytes() != p.read_bytes():
            shutil.copyfile(p, q)
            changed.append("+" + p.name)
    # Only prune when mirroring the main slug: a worktree slug holds a partial set
    # and must not delete memories that belong to the main session.
    if root == here:
        for q in dst.glob("*.md"):
            if q.name not in names:
                q.unlink()
                changed.append("-" + q.name)
    if changed:
        print("sync_memory:", " ".join(changed))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # never block the Stop hook
        print("sync_memory error:", e)
        sys.exit(0)
