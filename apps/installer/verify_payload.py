"""Verify the embedded installer bytes and an isolated file-installation probe.

Does not approve UAC. The exact inner Inno payload runs without elevation in a
project-owned directory, with system-registration flags disabled explicitly.
"""
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import uuid
import xml.etree.ElementTree as ET

from build import ROOT, NAME, digest


def embedded_payload_hash(executable):
    with executable.open('rb') as f:
        f.seek(0x3c)
        pe = struct.unpack('<I', f.read(4))[0]
        f.seek(pe)
        assert f.read(4) == b'PE\0\0'
        f.seek(pe + 6)
        section_count = struct.unpack('<H', f.read(2))[0]
        f.seek(pe + 20)
        optional_size = struct.unpack('<H', f.read(2))[0]
        optional = pe + 24
        f.seek(optional)
        magic = struct.unpack('<H', f.read(2))[0]
        directories = optional + (112 if magic == 0x20b else 96)
        f.seek(directories + 14 * 8)
        clr_rva = struct.unpack('<I', f.read(4))[0]
        f.seek(optional + optional_size)
        sections = [f.read(40) for _ in range(section_count)]

        def offset(rva):
            for section in sections:
                virtual_size, address, raw_size, pointer = struct.unpack_from('<IIII', section, 8)
                if address <= rva < address + max(virtual_size, raw_size):
                    return pointer + rva - address
            raise ValueError('RVA outside PE sections')

        f.seek(offset(clr_rva) + 24)
        resource_rva = struct.unpack('<I', f.read(4))[0]
        f.seek(offset(resource_rva))
        remaining = struct.unpack('<I', f.read(4))[0]
        size = remaining
        result = hashlib.sha256()
        while remaining:
            block = f.read(min(1024 * 1024, remaining))
            assert block, 'Truncated resource'
            remaining -= len(block)
            result.update(block)
        return size, result.hexdigest()


def execution_level(executable):
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]
    kernel.LoadLibraryExW.restype = wintypes.HMODULE
    kernel.FindResourceW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p]
    kernel.FindResourceW.restype = wintypes.HANDLE
    kernel.SizeofResource.argtypes = [wintypes.HMODULE, wintypes.HANDLE]
    kernel.SizeofResource.restype = wintypes.DWORD
    kernel.LoadResource.argtypes = [wintypes.HMODULE, wintypes.HANDLE]
    kernel.LoadResource.restype = wintypes.HANDLE
    kernel.LockResource.argtypes = [wintypes.HANDLE]
    kernel.LockResource.restype = ctypes.c_void_p
    kernel.FreeLibrary.argtypes = [wintypes.HMODULE]
    handle = kernel.LoadLibraryExW(str(executable.resolve()), None, 0x22)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        resource = kernel.FindResourceW(handle, 1, 24)
        assert resource
        blob = ctypes.string_at(kernel.LockResource(kernel.LoadResource(handle, resource)),
            kernel.SizeofResource(handle, resource))
        return ET.fromstring(blob).find('.//{urn:schemas-microsoft-com:asm.v3}requestedExecutionLevel').attrib['level']
    finally:
        kernel.FreeLibrary(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--release', type=Path, default=ROOT / '_rea_temp/windows-installer/ui-6')
    args = parser.parse_args()
    release = args.release.resolve()
    release.relative_to(ROOT / '_rea_temp/windows-installer')
    setup = release / NAME
    source = release / 'source'
    payload = ROOT / '_rea_temp/windows-installer/release' / NAME
    expected_ui = json.loads((release / 'ui-files.json').read_text(encoding='utf-8'))
    size, sha = embedded_payload_hash(setup)
    assert size == payload.stat().st_size and sha == digest(payload), 'Embedded Inno bytes differ'
    assert execution_level(setup) == 'requireAdministrator'
    assert execution_level(source / 'DrawingStudio.exe') == 'asInvoker'
    print('PASS embedded payload SHA256 and administrator manifest', flush=True)

    work = release / ('payload-check-' + uuid.uuid4().hex[:8])
    work.mkdir()
    installed = work / 'installed'
    temporary = work / 'temp'
    temporary.mkdir()
    log = work / 'install.log'
    env = dict(os.environ, TEMP=str(temporary), TMP=str(temporary),
        DRAWINGSTUDIO_UNINSTALL_REGISTRY='0', DRAWINGSTUDIO_START_MENU='0', DRAWINGSTUDIO_DESKTOP='0')
    subprocess.run([str(payload), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOICONS',
        '/DIR=' + str(installed), '/LOG=' + str(log)], env=env, timeout=300, check=True, creationflags=0x08000000)
    text = log.read_text(encoding='utf-8-sig', errors='replace')
    assert 'Fatal exception' not in text and 'Exception message:' not in text
    actual_paths = {str(p.relative_to(installed)).replace('\\', '/') for p in (installed / 'ui').rglob('*') if p.is_file()}
    assert actual_paths == set(expected_ui)
    for name, expected in expected_ui.items():
        assert digest(installed / name) == expected, name
    core_files = ['DrawingStudio.exe', 'DrawingStudio.dll', 'DrawingStudio.deps.json',
        'content/library.json', 'content/index/catalog.json']
    for name in core_files:
        assert digest(installed / name) == digest(source / name), name
    assert digest(installed / 'content/library.json') == digest(ROOT / '_rea_temp/reader/content/library.json')
    assert not (installed / 'test-profile').exists() and not (installed / 'user-data').exists()
    for name in ['打开图序.lnk', '卸载图序.lnk', 'unins000.exe']:
        assert (installed / name).is_file(), name
    shortcut_icons = {}
    if (release / 'icon-verification.json').exists():
        for name in ['打开图序.lnk', '卸载图序.lnk']:
            literal = "'" + str(installed / name).replace("'", "''") + "'"
            command = '$taskShell=New-Object -ComObject WScript.Shell; $taskShortcut=$taskShell.CreateShortcut(' + literal + '); [Console]::OutputEncoding=[Text.Encoding]::UTF8; Write-Output $taskShortcut.IconLocation'
            result = subprocess.run(['powershell.exe','-NoProfile','-Command',command],capture_output=True,check=True)
            icon = result.stdout.decode('utf-8-sig').strip()
            assert os.path.normcase(icon.rsplit(',',1)[0]) == os.path.normcase(str(installed / 'DrawingStudio.exe')), icon
            shortcut_icons[name] = icon
    print('PASS actual installed UI, core files, shortcut files and clean profile state', flush=True)

    env['STUDIO_OUTPUT'] = str(installed)
    subprocess.run(['C:/Program Files/nodejs/node.exe', str(ROOT / 'apps/desktop/verify-startup.mjs')],
        env=env, check=True, timeout=120)
    startup = json.loads((installed / 'normal-startup-verification.json').read_text(encoding='utf-8-sig'))
    assert startup['passed']
    window_status = json.loads((installed / 'startup-status.json').read_text(encoding='utf-8-sig'))
    if (release / 'icon-verification.json').exists():
        assert window_status['brandIconLoaded'] and window_status['windowIconSize']==[32,32]
    sentinel = installed / 'user-data/retain-on-uninstall.txt'
    sentinel.parent.mkdir(exist_ok=True)
    sentinel.write_text('retain user settings', encoding='utf-8')
    subprocess.run([str(installed / 'unins000.exe'), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'],
        env=env, check=True, timeout=120, creationflags=0x08000000)
    assert not (installed / 'DrawingStudio.exe').exists()
    assert sentinel.read_text(encoding='utf-8') == 'retain user settings'
    preview = ROOT / '_rea_temp/desktop-ui-preview'
    report = {'passed': True, 'installerSha256': digest(setup), 'payloadSha256': sha,
        'embeddedPayloadVerified': True, 'embeddedManifests': {'installer': 'requireAdministrator', 'reader': 'asInvoker'},
        'uiFilesVerified': len(expected_ui), 'installedCoreFilesVerified': core_files, 'cleanProfiles': True,
        'sourceLibraryUnchanged': True, 'normalStartup': startup, 'uninstalled': True, 'userDataPreserved': True,
        'shortcutIcons': shortcut_icons, 'windowBrandIconLoaded':window_status.get('brandIconLoaded',False),
        'ui': json.loads((preview / 'ui-verification.json').read_text(encoding='utf-8')),
        'layoutAndStartup': json.loads((preview / 'reading-layout-verification.json').read_text(encoding='utf-8')),
        'coreRegression': json.loads((preview / 'android-style/studio-selfcheck.json').read_text(encoding='utf-8')),
        'signature': 'NotSigned', 'elevatedInstallationVerified': False,
        'scope': 'Exact embedded Inno payload tested without UAC in a project-only directory; '
            'HKCU/start-menu/desktop flags disabled for this restricted host. Verified files, normal startup and uninstall. '
            'Public wrapper administrator manifest inspected, but UAC consent and elevated AppData installation not automated.'}
    (release / 'installer-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('PASS payload startup, uninstall and settings retention', flush=True)


if __name__ == '__main__':
    main()
