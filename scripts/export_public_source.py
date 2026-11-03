"""Create an audited code-and-content snapshot; never pushes or signs."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile
from public_source import ROOT, source_files
from audit_public_source import audit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT/'GitHub准备')
    args = parser.parse_args()
    output = args.output.resolve()
    if ROOT not in output.parents: raise SystemExit('Output must stay inside this workspace.')
    report = audit()
    if not report['passed']:
        print(json.dumps(report, ensure_ascii=False, indent=2)); raise SystemExit(1)
    target = output/'tuxu-source'
    if target.exists(): raise SystemExit('Use a fresh output directory; existing snapshots are never overwritten.')
    target.mkdir(parents=True)
    manifest = []
    for path in sorted(source_files()):
        rel = path.relative_to(ROOT)
        dest = target/rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        manifest.append({'path': rel.as_posix(), 'bytes': path.stat().st_size,
                         'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    archive = output/'tuxu-source.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipout:
        for item in manifest:
            path = target/item['path']
            info = zipfile.ZipInfo('tuxu-source/'+item['path'], (2026, 11, 3, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100755 if path.name == 'gradlew' else 0o100644) << 16
            zipout.writestr(info, path.read_bytes())
    (output/'source-manifest.json').write_text(json.dumps({'audit': report, 'files': manifest,
        'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'source': str(target), 'zip': str(archive), 'files':len(manifest), 'bytes':archive.stat().st_size}, ensure_ascii=False))


if __name__ == '__main__': main()
