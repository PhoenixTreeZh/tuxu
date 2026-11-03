"""Build a single EXE whose bootstrap does not depend on system TEMP.

The Framework launcher embeds, verifies and launches the original Inno payload.
No machine environment variables or Windows security settings are changed.
"""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
COMPILER = Path('C:/Program Files/Inno Setup 7/ISCC.exe')
CSC = Path('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe')
NAME = 'DrawingStudio-1.1.0-win-x64-Setup.exe'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def wrap(payload, output, work):
    work.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    expected = digest(payload)
    metadata = work / 'SetupPayload.cs'
    metadata.write_text('using System.Reflection;\n'
        '[assembly: AssemblyTitle("图序安装程序")]\n'
        '[assembly: AssemblyDescription("图序安装程序 · AppData 安装")]\n'
        '[assembly: AssemblyVersion("1.1.0.7")]\n'
        '[assembly: AssemblyFileVersion("1.1.0.7")]\n'
        'internal static class SetupPayload { internal const string Sha256 = "' + expected + '"; }\n', encoding='utf-8')
    env = dict(os.environ, TEMP=str(work), TMP=str(work))
    subprocess.run([str(CSC), '/nologo', '/target:winexe', '/platform:x64', '/optimize+',
        '/reference:System.Windows.Forms.dll', '/win32manifest:' + str(Path(__file__).with_name('launcher.manifest')),
        '/win32icon:' + str(ROOT / 'assets/brand/app.ico'),
        '/resource:' + str(payload) + ',DrawingStudio.SetupPayload', '/out:' + str(output),
        str(Path(__file__).with_name('SetupLauncher.cs')), str(metadata)], env=env, check=True)
    return expected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / '新版软件/图序-React版')
    parser.add_argument('--payload', type=Path, help='Wrap an already compiled Inno payload')
    parser.add_argument('--output', type=Path, default=ROOT / '安装包/Windows' / NAME)
    args = parser.parse_args()
    work = ROOT / '_rea_temp/windows-installer/release'
    work.mkdir(parents=True, exist_ok=True)
    payload = args.payload.resolve() if args.payload else work / NAME
    if not args.payload:
        if not (args.source / 'DrawingStudio.exe').is_file():
            raise SystemExit('Release executable missing')
        cmd = [str(COMPILER), '/Q', '/DSourceDir=' + str(args.source.resolve()), '/DOutputDir=' + str(work)]
        subprocess.run(cmd + [str(Path(__file__).with_name('DrawingStudio.iss'))],
            env=dict(os.environ, TEMP=str(work), TMP=str(work)), check=True)
    output = args.output.resolve()
    if payload == output:
        raise SystemExit('Payload and wrapper output must be different files')
    expected = wrap(payload, output, work)
    print('Built:', output)
    print('Payload SHA256:', expected)
    print('Installer SHA256:', digest(output))


if __name__ == '__main__':
    main()
