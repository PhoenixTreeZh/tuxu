"""Export the Android vector unchanged as shared SVG, PNG and Windows ICO.

Uses the project's existing Inkscape renderer. Small ICO frames are conventional
32-bit DIBs; the 256px frame is lossless PNG. No AI or new logo geometry is used.
"""
from pathlib import Path
import hashlib
import json
import os
import struct
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ANDROID = ROOT / 'apps/android/app/src/main/res/drawable/ic_launcher.xml'
INKSCAPE = ROOT / '_rea_temp/toolchains/inkscape/inkscape/bin/inkscape.exe'
ATTR = '{http://schemas.android.com/apk/res/android}'


def main():
    vector = ET.fromstring(ANDROID.read_text(encoding='utf-8'))
    svg = ET.Element('svg', xmlns='http://www.w3.org/2000/svg', viewBox='0 0 ' + vector.attrib[ATTR+'viewportWidth'] + ' ' + vector.attrib[ATTR+'viewportHeight'], width='108', height='108')
    mapping = {'pathData':'d', 'strokeColor':'stroke', 'strokeWidth':'stroke-width', 'strokeLineJoin':'stroke-linejoin', 'strokeLineCap':'stroke-linecap'}
    for path in vector:
        attributes = {target:path.attrib[ATTR+source] for source,target in mapping.items() if ATTR+source in path.attrib}
        fill = path.attrib.get(ATTR+'fillColor', '#000000')
        attributes['fill'] = 'none' if fill == '#00000000' else fill
        ET.SubElement(svg, 'path', attributes)
    ET.indent(svg)
    (OUT/'app-icon.svg').write_text(ET.tostring(svg, encoding='unicode')+'\n', encoding='utf-8')
    work = ROOT/'_rea_temp/windows-installer/icon-7/icon-frames'
    work.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, TEMP=str(work), TMP=str(work), INKSCAPE_PROFILE_DIR=str(work/'inkscape-profile'))
    sizes = [16,20,24,32,40,48,64,96,128,256]
    images = []
    for size in [*sizes,512]:
        destination = work/(str(size)+'.png')
        subprocess.run([str(INKSCAPE), str(OUT/'app-icon.svg'), '--export-type=png',
            '--export-filename='+str(destination), '--export-width='+str(size), '--export-height='+str(size)],
            env=env, check=True, capture_output=True)
        with Image.open(destination) as image:
            rgba = image.convert('RGBA')
            assert rgba.size == (size,size)
            assert rgba.getpixel((0,0)) == (37,95,73,255), 'Android green changed'
            if size == 512:
                (OUT/'app-icon.png').write_bytes(destination.read_bytes())
                continue
            if size == 256:
                blob = destination.read_bytes()
            else:
                pixels = rgba.transpose(Image.Transpose.FLIP_TOP_BOTTOM).tobytes('raw','BGRA')
                mask = bytes(((size+31)//32)*4*size)
                header = struct.pack('<IIIHHIIIIII',40,size,size*2,1,32,0,len(pixels)+len(mask),0,0,0,0)
                blob = header+pixels+mask
            images.append((size,blob))
    offset = 6+16*len(images)
    entries = []
    for size,blob in images:
        entries.append(struct.pack('<BBBBHHII',0 if size==256 else size,0 if size==256 else size,0,0,1,32,len(blob),offset))
        offset += len(blob)
    (OUT/'app.ico').write_bytes(struct.pack('<HHH',0,1,len(images))+b''.join(entries)+b''.join(blob for _,blob in images))
    with Image.open(OUT/'app.ico') as icon:
        assert icon.ico.sizes() == {(n,n) for n in sizes}
    report = {'source':str(ANDROID.relative_to(ROOT)), 'sourceSha256':hashlib.sha256(ANDROID.read_bytes()).hexdigest(),
        'sameAndroidGeometryAndColors':True, 'sizes':sizes, 'icoSha256':hashlib.sha256((OUT/'app.ico').read_bytes()).hexdigest()}
    (work.parent/'icon-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Android vector exported unchanged; Windows icon sizes:', sizes)


if __name__ == '__main__':
    main()
