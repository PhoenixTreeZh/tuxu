"""Explicit public-source boundary shared by the auditor and exporter."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOP_FILES = {'.gitignore', '.gitattributes', 'LICENSE', 'README.md',
             'THIRD_PARTY_NOTICES.md', 'NuGet.Config', 'global.json'}
TREES = {'.github', 'docs', 'scripts', 'samples', 'assets', 'content'}
APPS = {'android', 'desktop', 'installer', 'studio'}
SHARED = {'Library.cs', 'NativeText.cs', 'SceneRenderer.cs', 'SceneVerification.cs'}
SKIP_DIRS = {'node_modules', 'bin', 'obj', 'dist', 'build', '.gradle', '.kotlin',
             '__pycache__', 'test-profile', 'user-data', '.idea', '.git'}
SKIP_SUFFIXES = {'.pyc', '.log', '.tmp', '.pending', '.tsbuildinfo'}


def allowed(relative):
    p = Path(relative)
    parts = p.parts
    if not parts or any(x in SKIP_DIRS for x in parts): return False
    if p.suffix.lower() in SKIP_SUFFIXES or p.name == 'local.properties': return False
    if len(parts) == 1: return p.name in TOP_FILES
    if parts[0] in TREES: return True
    if parts[0] != 'apps' or len(parts) < 3: return False
    if parts[1] == 'windows': return len(parts) == 3 and parts[2] in SHARED
    if parts[1] not in APPS: return False
    # Include the unpacked Android question bank as well as application sources.
    return True


def source_files(root=ROOT):
    import os
    for directory, directories, files in os.walk(root, followlinks=False):
        base = Path(directory)
        relative = base.relative_to(root)
        directories[:] = [x for x in directories if not (base/x).is_symlink()
                          and ((relative/x).as_posix() in {'apps', 'apps/windows'}
                               or allowed(relative/x/'_probe'))]
        for name in sorted(files):
            path = base/name
            if not path.is_symlink() and allowed(path.relative_to(root)):
                yield path
