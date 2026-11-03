"""Check public files without printing secret values or matching source text."""
import argparse
import json
import re
import subprocess
from pathlib import Path
from public_source import ROOT, allowed, source_files

PATTERNS = {
    'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'GitHub credential': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b'),
    'AWS access key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'URL credential': re.compile(r'https?://[^\s/"\'<>:]+:[^\s/"\'<>]+@'),
    'personal absolute path': re.compile(r'(?i)[A-Z]:[/\\]Users[/\\][^/\\\s"\']+'),
}
PRIVATE_SUFFIXES = {'.p12', '.pfx', '.jks', '.keystore', '.key', '.pem', '.exe', '.dll', '.apk', '.aab', '.msi', '.zip', '.7z', '.rar'}
BINARY_SUFFIXES = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.wmf', '.mp4', '.webm', '.avi', '.jar', '.woff', '.woff2'}


def audit(root=ROOT):
    files = sorted(source_files(root))
    issues = []
    # In a checkout also detect tracked files outside the export boundary, even if ignored.
    if (root/'.git').exists():
        result = subprocess.run(['git', '-C', str(root), 'ls-files', '-z'], capture_output=True, check=True)
        for name in result.stdout.decode('utf-8').split('\0'):
            if name and not allowed(name): issues.append({'file': name, 'reason': 'outside public boundary'})
    size = 0
    for path in files:
        rel = path.relative_to(root).as_posix()
        size += path.stat().st_size
        if path.stat().st_size >= 100*1024*1024: issues.append({'file': rel, 'reason': '100 MiB file limit'})
        if path.suffix.lower() in PRIVATE_SUFFIXES or path.name.startswith('.env') or path.name in {'password.txt', 'key.properties', 'credentials.json', 'secrets.json'}:
            issues.append({'file': rel, 'reason': 'private or binary release file'})
        if path.suffix.lower() in BINARY_SUFFIXES: continue
        raw = path.read_bytes()
        if b'\x00' in raw: continue
        try: body = raw.decode('utf-8-sig')
        except UnicodeDecodeError: continue
        for label, pattern in PATTERNS.items():
            for match in pattern.finditer(body):
                issues.append({'file': rel, 'line': body.count('\n', 0, match.start())+1, 'reason': label})
    return {'passed': not issues, 'files': len(files), 'bytes': size, 'issues': issues}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    report = audit(args.root.resolve())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report['passed'] else 1)
