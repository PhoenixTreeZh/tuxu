"""Read Windows PE icon resources without starting the executable."""
from pathlib import Path
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parents[2]


def icon_images(path):
    data = path.read_bytes()
    count = struct.unpack_from('<H', data, 4)[0]
    result = set()
    for i in range(count):
        size, offset = struct.unpack_from('<II', data, 6+i*16+8)
        result.add(hashlib.sha256(data[offset:offset+size]).hexdigest())
    return result


def verify(executable):
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
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ssize_t)
    kernel.EnumResourceNamesW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, callback_type, ctypes.c_ssize_t]
    kernel.EnumResourceNamesW.restype = wintypes.BOOL
    handle = kernel.LoadLibraryExW(str(executable.resolve()), None, 0x22)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        names = []
        @callback_type
        def collect(module, kind, name, data):
            names.append(name if name <= 65535 else ctypes.wstring_at(name))
            return True
        assert kernel.EnumResourceNamesW(handle, 14, collect, 0), 'No PE group icon'

        def resource(name, kind):
            buffer = ctypes.create_unicode_buffer(name) if isinstance(name,str) else None
            key = ctypes.cast(buffer,ctypes.c_void_p) if buffer is not None else name
            found = kernel.FindResourceW(handle,key,kind)
            assert found
            return ctypes.string_at(kernel.LockResource(kernel.LoadResource(handle,found)),kernel.SizeofResource(handle,found))

        expected = icon_images(ROOT/'assets/brand/app.ico')
        groups = []
        for name in names:
            group = resource(name,14)
            count = struct.unpack_from('<H',group,4)[0]
            hashes = set()
            for i in range(count):
                item = struct.unpack_from('<H',group,6+i*14+12)[0]
                hashes.add(hashlib.sha256(resource(item,3)).hexdigest())
            groups.append({'id':name,'frames':count,'matchesAndroidExport':hashes==expected})
        assert groups[0]['matchesAndroidExport'], (str(executable),groups)
        return {'file':str(executable),'groups':groups,'passed':True}
    finally:
        kernel.FreeLibrary(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('executables', nargs='+', type=Path)
    parser.add_argument('--output',type=Path,default=ROOT/'_rea_temp/windows-installer/icon-7/embedded-icon-verification.json')
    args = parser.parse_args()
    report = {'passed':True,'files':[verify(path) for path in args.executables]}
    status = ROOT/'_rea_temp/desktop-ui-preview/android-style/startup-status.json'
    if status.exists():
        window = json.loads(status.read_text(encoding='utf-8-sig'))
        if window.get('brandIconLoaded'):
            assert window['windowIconSize']==[32,32]
            report['windowIconLoaded']=True
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))


if __name__ == '__main__':
    main()
