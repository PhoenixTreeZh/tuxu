"""Export the source scene graph as portable SVG paths, not answer screenshots."""
from __future__ import annotations
import base64, concurrent.futures, copy, ctypes as C, hashlib, io, json, os, pathlib, re, shutil, subprocess, sys, xml.etree.ElementTree as E, faulthandler, struct
from ctypes import wintypes as W
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2]
ALIASES=ROOT/'_rea_temp/release-android/path-alias.json'
if ALIASES.exists():ROOT=pathlib.Path(json.loads(ALIASES.read_text(encoding='utf-8-sig'))['alias'])
CONTENT=ROOT/'content/windows'
if not (CONTENT/'library.json').is_file():CONTENT=ROOT/'_rea_temp/reader/content'
WORK=ROOT/'_rea_temp/release-android'
OUTPUT=ROOT/'apps/android/app/src/main/assets/content'
FONTROOT=pathlib.Path(os.environ.get('TUXU_FONTCONFIG_ROOT',str(WORK/'fontconfig')))
SVG='http://www.w3.org/2000/svg'; XLINK='http://www.w3.org/1999/xlink'
E.register_namespace('',SVG);E.register_namespace('xlink',XLINK)
def short(path):
    buffer=C.create_unicode_buffer(32768)
    if not C.windll.kernel32.GetShortPathNameW(str(path),buffer,len(buffer)):return str(path)
    return buffer.value
def color(rgb):return '#'+''.join(f'{x:02x}' for x in rgb)
def element(tag,**attributes):return E.Element('{'+SVG+'}'+tag,{k.replace('_','-'):str(v) for k,v in attributes.items()})
def number(value):return f'{value:.6g}'
def pixels(value):
    m=re.match(r'([\d.]+)(.*)',value);return float(m[1])*{'mm':96/25.4,'cm':96/2.54,'in':96,'pt':96/72,'px':1,'':1}[m[2]]

def convert_metafiles(library):
    FONTROOT.mkdir(parents=True,exist_ok=True)
    (FONTROOT/'cache').mkdir(exist_ok=True)
    (FONTROOT/'fonts.conf').write_text('<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>C:/Windows/Fonts</dir><cachedir>'+str(FONTROOT/'cache').replace('\\','/')+'</cachedir></fontconfig>',encoding='utf-8')
    sources=sorted({o['path'] for f in library['frames'].values() if f.get('scene') for o in f['scene']['operations'] if o['kind']=='metafile'})
    destination=WORK/'metafiles';destination.mkdir(exist_ok=True)
    pending=[p for p in sources if not (destination/(pathlib.Path(p).stem+'.svg')).exists()]
    executable=ROOT/'_rea_temp/toolchains/inkscape/inkscape/bin/inkscape.com'
    def convert(batch):
        source=batch[0];out=destination/(pathlib.Path(source).stem+'.svg')
        (WORK/'inkscape-profile').mkdir(exist_ok=True)
        env={**os.environ,'FONTCONFIG_PATH':str(FONTROOT),'FONTCONFIG_FILE':str(FONTROOT/'fonts.conf'),'XDG_CACHE_HOME':str(FONTROOT/'cache'),'INKSCAPE_PROFILE_DIR':str(WORK/'inkscape-profile'),'TEMP':str(WORK),'TMP':str(WORK)}
        try:result=subprocess.run([str(executable),str(CONTENT/source),'--export-type=svg','--export-plain-svg','--export-filename='+str(out),'--actions=select-all:all;object-to-path;export-do'],capture_output=True,timeout=60,env=env,cwd=WORK)
        except subprocess.TimeoutExpired as e:
            (WORK/'inkscape-timeout.log').write_bytes((e.stdout or b'')+(e.stderr or b''));raise
        log=WORK/f'inkscape-{pathlib.Path(batch[0]).stem[:8]}.log';log.write_bytes(result.stdout+result.stderr)
        if result.returncode:raise RuntimeError(f'Inkscape failed: {log}')
    if pending:
        batches=[[source] for source in pending]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for i,_ in enumerate(pool.map(convert,batches),1):print(f'WMF batches {i}/{len(batches)}',flush=True)
    result={}
    for source in sources:
        path=destination/(pathlib.Path(source).stem+'.svg');root=E.parse(path).getroot()
        for parent in root.iter():
            for child in list(parent):
                if child.tag=='{'+SVG+'}text':
                    if ''.join(child.itertext()).strip():raise ValueError(f'Unoutlined text: {source}')
                    parent.remove(child)
        root.set('viewBox',f"0 0 {pixels(root.attrib['width'])} {pixels(root.attrib['height'])}")
        native_metafile_text(CONTENT/source,root)
        result[source]=root
    return result

# GDI gives the Windows source font outlines and advance widths. Android never
# substitutes its own fonts for diagram labels and needs no Windows font files.
gdi=C.WinDLL('gdi32',use_last_error=True)
class Point(C.Structure):_fields_=[('x',W.LONG),('y',W.LONG)]
class Size(C.Structure):_fields_=[('cx',W.LONG),('cy',W.LONG)]
def declare(name,restype,*args):
    fn=getattr(gdi,name);fn.restype=restype;fn.argtypes=list(args);return fn
create_dc=declare('CreateCompatibleDC',W.HDC,W.HDC)
delete_dc=declare('DeleteDC',W.BOOL,W.HDC)
create_font=declare('CreateFontW',W.HFONT,W.INT,W.INT,W.INT,W.INT,W.INT,W.DWORD,W.DWORD,W.DWORD,W.DWORD,W.DWORD,W.DWORD,W.DWORD,W.DWORD,W.LPCWSTR)
select=declare('SelectObject',W.HGDIOBJ,W.HDC,W.HGDIOBJ)
delete=declare('DeleteObject',W.BOOL,W.HGDIOBJ)
align=declare('SetTextAlign',W.UINT,W.HDC,W.UINT)
background=declare('SetBkMode',W.INT,W.HDC,W.INT)
textout=declare('TextOutW',W.BOOL,W.HDC,W.INT,W.INT,W.LPCWSTR,W.INT)
extent=declare('GetTextExtentPoint32W',W.BOOL,W.HDC,W.LPCWSTR,W.INT,C.POINTER(Size))
begin=declare('BeginPath',W.BOOL,W.HDC);end=declare('EndPath',W.BOOL,W.HDC)
getpath=declare('GetPath',W.INT,W.HDC,C.POINTER(Point),C.POINTER(W.BYTE),W.INT)
extout=declare('ExtTextOutA',W.BOOL,W.HDC,W.INT,W.INT,W.UINT,C.c_void_p,C.c_char_p,W.UINT,C.POINTER(W.INT))
def current_path(dc):
    count=getpath(dc,None,None,0)
    if count<0:raise RuntimeError('WMF font outline failed')
    points=(Point*count)();types=(W.BYTE*count)();getpath(dc,points,types,count)
    commands=[];i=0
    while i<count:
        kind=types[i]&6
        if kind==4:
            commands.append('C'+' '.join(f'{points[j].x},{points[j].y}' for j in range(i,i+3)));i+=3
        else:
            commands.append(('M' if kind==6 else 'L')+f'{points[i].x},{points[i].y}');i+=1
        if types[i-1]&1:commands.append('Z')
    return ' '.join(commands)
def native_metafile_text(source,root):
    """Keep WMF EXTTextOut glyphs, primes and ANSI advances via native GDI.

    Inkscape's WMF importer removes apostrophes from a'/a'' and mangles GBK.
    Only text is replayed here; shapes remain the converted source paths.
    """
    data=source.read_bytes();placeable=data[:4]==b'\xd7\xcd\xc6\x9a';offset=(22 if placeable else 0)+18
    objects=[];font_data=None;alignment=0;text_color=0;origin=(0,0);window=(1,1);runs=[]
    dc=create_dc(None);background(dc,1)
    try:
        while offset+6<=len(data):
            size,kind=struct.unpack_from('<IH',data,offset)
            if size<3:break
            body=data[offset+6:offset+size*2];offset+=size*2
            if kind in (0x2fa,0x2fc,0x2fb,0xf7,0x6ff,0x142,0x1f9,0x2fd,0x6fe):
                item=(kind,body)
                if None in objects:objects[objects.index(None)]=item
                else:objects.append(item)
            elif kind==0x1f0:
                i=struct.unpack_from('<H',body)[0]
                if i<len(objects):objects[i]=None
            elif kind==0x12d:
                i=struct.unpack_from('<H',body)[0]
                if i<len(objects) and objects[i] and objects[i][0]==0x2fb:font_data=objects[i][1]
            elif kind==0x12e:alignment=struct.unpack_from('<H',body)[0]&~1
            elif kind==0x209:text_color=struct.unpack_from('<I',body)[0]
            elif kind==0x20b:
                y,x=struct.unpack_from('<hh',body);origin=(x,y)
            elif kind==0x20c:
                y,x=struct.unpack_from('<hh',body);window=(x,y)
            elif kind==0xa32:
                y,x,count,options=struct.unpack_from('<hhHH',body);start=16 if options&6 else 8
                raw=body[start:start+count];after=start+count+(count%2);remaining=body[after:]
                if not raw.strip():continue
                result=None
                if font_data is not None:
                    parameters=list(struct.unpack_from('<hhhhhBBBBBBBB',font_data))
                    face=font_data[18:50].split(b'\0')[0].decode('gbk',errors='replace')
                    handle=create_font(*parameters,face);old=select(dc,handle);align(dc,alignment)
                    dx=(W.INT*(len(remaining)//2))(*struct.unpack('<'+'h'*(len(remaining)//2),remaining)) if remaining else None
                    try:
                        if not begin(dc) or not extout(dc,x,y,0,None,raw,count,dx) or not end(dc):raise RuntimeError('WMF text replay failed')
                        path=current_path(dc)
                        if path:
                            vx,vy=[float(v) for v in root.get('viewBox').split()[2:]]
                            sx=vx/(abs(window[0])+1)*(1 if window[0]>=0 else -1);sy=vy/(abs(window[1])+1)*(1 if window[1]>=0 else -1)
                            result=element('g',transform=f'scale({number(sx)},{number(sy)}) translate({-origin[0]},{-origin[1]})')
                            result.append(element('path',d=path,fill=color([text_color&255,(text_color>>8)&255,(text_color>>16)&255]),fill_rule='evenodd'))
                            result.set('aria-label',raw.decode('gbk',errors='replace'))
                    finally:select(dc,old);delete(handle)
                runs.append(result)
    finally:delete_dc(dc)
    labels=[node for node in root.iter() if 'aria-label' in node.attrib]
    if len(labels)!=len(runs):
        raise ValueError(f'WMF text count differs: {source.name}: {len(labels)} imported, {len(runs)} native')
    replacements=dict(zip(map(id,labels),runs))
    for parent in list(root.iter()):
        for index,child in enumerate(list(parent)):
            replacement=replacements.get(id(child))
            if replacement is not None:parent.remove(child);parent.insert(index,replacement)
def text_paths(lines):
    dc=create_dc(None);background(dc,1);align(dc,24);result=[]
    try:
        for line in lines:
            x=line['x'];y=line['baseline']
            for run in line['runs']:
                text=run['text'].replace('\r','').replace('\n','')
                if not text:continue
                f=run['font_request']
                args=[f['stored_height_i16'],0,0,0,f['weight_rule_for_stored_face'],int(f['italic_mask2']),int(f['underline_mask4']),0,1,0,0,0,0,f['requested_windows_family']]
                font=create_font(*args);old=select(dc,font);size=Size()
                if not extent(dc,text,len(text),C.byref(size)):raise RuntimeError('Font advance failed')
                select(dc,old);delete(font)
                args[0]*=8;font=create_font(*args);old=select(dc,font)
                try:
                    if not begin(dc) or not textout(dc,x*8,y*8,text,len(text)) or not end(dc):raise RuntimeError('Text outline failed')
                    count=getpath(dc,None,None,0)
                    if count<0:raise RuntimeError('GetPath failed')
                    points=(Point*count)();types=(W.BYTE*count)();getpath(dc,points,types,count)
                    commands=[];i=0
                    while i<count:
                        kind=types[i]&6
                        if kind==4:
                            commands.append('C'+' '.join(f'{number(points[j].x/8)},{number(points[j].y/8)}' for j in range(i,i+3)));i+=3
                        else:
                            commands.append(('M' if kind==6 else 'L')+f'{number(points[i].x/8)},{number(points[i].y/8)}');i+=1
                        if types[i-1]&1:commands.append('Z')
                    if commands:result.append(element('path',d=' '.join(commands),fill=color(run['color']),fill_rule='evenodd'))
                finally:select(dc,old);delete(font)
                x+=size.cx
    finally:delete_dc(dc)
    return result

def export():
    diagnostic=(WORK/'export-stack.log').open('w')
    faulthandler.dump_traceback_later(60,repeat=True,file=diagnostic)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    library=json.loads((CONTENT/'library.json').read_text(encoding='utf-8'))
    metafiles=convert_metafiles(library)
    destination=OUTPUT/'scenes';destination.mkdir(exist_ok=True)
    assets={};frame_paths={};counts={};images={}
    for fid,frame in library['frames'].items():
        scene=frame.get('scene')
        if not scene:continue
        left,top,right,bottom=scene['viewport'];width=right-left;height=bottom-top
        root=element('svg',width=width,height=height,viewBox=f'{left} {top} {width} {height}')
        root.append(element('rect',x=left,y=top,width=width,height=height,fill='#000000'))
        for index,op in enumerate(scene['operations']):
            kind=op['kind'];counts[kind]=counts.get(kind,0)+1
            rect=op.get('rect',[0,0,0,0]);x,y,r,b=rect
            if kind=='metafile':
                child=copy.deepcopy(metafiles[op['path']]);child.set('x',str(x));child.set('y',str(y));child.set('width',str(r-x));child.set('height',str(b-y));child.set('preserveAspectRatio','none')
                # WMF cosmetic pens are clamped to one device pixel by GDI.
                # SVG's fractional 0.02px strokes would otherwise disappear.
                view_width=float(child.attrib['viewBox'].split()[2]);view_height=float(child.attrib['viewBox'].split()[3])
                minimum_pen=max(view_width/(r-x),view_height/(b-y))
                for node in child.iter():
                    style=node.get('style','')
                    if 'stroke:none' not in style:
                        style=re.sub(r'stroke-width:([\d.eE+-]+)(px)?',lambda m:'stroke-width:'+number(max(float(m[1]),minimum_pen))+'px' if float(m[1])>0 else m[0],style)
                        if style:node.set('style',style)
                # Scope paint-server/clip IDs for scenes with multiple WMFs.
                prefix=f'm{index}-'
                ids={node.attrib['id']:prefix+node.attrib['id'] for node in child.iter() if 'id' in node.attrib}
                for node in child.iter():
                    for key,value in list(node.attrib.items()):
                        if key=='id':node.set(key,ids[value])
                        elif 'url(#' in value:node.set(key,re.sub(r'url\(#([^)]+)\)',lambda match:'url(#'+ids.get(match[1],match[1])+')',value))
                        elif key.endswith('href') and value.startswith('#'):node.set(key,'#'+ids.get(value[1:],value[1:]))
                root.append(child)
            elif kind=='bitmap':
                path=op['path']
                if path not in images:
                    with Image.open(CONTENT/path) as image:
                        out=io.BytesIO();image.convert('RGB').save(out,format='PNG');images[path]='data:image/png;base64,'+base64.b64encode(out.getvalue()).decode()
                child=element('image',x=x,y=y,width=r-x,height=b-y,preserveAspectRatio='none');child.set('{'+XLINK+'}href',images[path]);root.append(child)
            elif kind=='text':
                if op.get('fill_background') and op.get('background_color'):
                    root.append(element('rect',x=x,y=y,width=r-x,height=b-y,fill=color(op['background_color'])))
                root.extend(text_paths(op['lines']))
            else:
                attributes={'fill':'none','stroke':color(op['color']),'stroke_width':op.get('pen_width',1)} if kind.startswith('stroke_') or kind=='line' else {'fill':color(op['color'])}
                if kind.endswith('rectangle'):child=element('rect',x=x,y=y,width=r-x,height=b-y,**attributes)
                elif kind.endswith('ellipse'):child=element('ellipse',cx=(x+r)/2,cy=(y+b)/2,rx=(r-x)/2,ry=(b-y)/2,**attributes)
                elif kind=='line':
                    a,z=op['points'];child=element('line',x1=a[0],y1=a[1],x2=z[0],y2=z[1],**attributes)
                elif kind=='fill_polygon':child=element('polygon',points=' '.join(f'{a},{z}' for a,z in op['points']),fill_rule='evenodd',**attributes)
                else:raise ValueError(kind)
                root.append(child)
        data=E.tostring(root,encoding='utf-8',xml_declaration=True);name=hashlib.sha256(data).hexdigest()+'.svg'
        (destination/name).write_bytes(data);frame_paths[fid]='scenes/'+name
        if len(frame_paths)%100==0:print(f'SVG scenes {len(frame_paths)}',flush=True)
    (WORK/'scene-map.json').write_text(json.dumps(frame_paths),encoding='utf-8')
    manifest={'librarySha256':hashlib.sha256((CONTENT/'library.json').read_bytes()).hexdigest(),'frames':[{'id':fid,'svg':path,'width':library['frames'][fid]['width'],'height':library['frames'][fid]['height'],'viewport':library['frames'][fid]['scene']['viewport'],'vector':library['frames'][fid]['scene']['vector_asset_count']>0} for fid,path in frame_paths.items()]}
    (destination/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
    shutil.copytree(CONTENT/'index',OUTPUT/'index',dirs_exist_ok=True)
    referenced=set()
    for path in (OUTPUT/'index/questions').glob('*.json'):
        document=json.loads(path.read_text(encoding='utf-8'))
        for fid,frame in document['frames'].items():frame['svg']=frame_paths[fid]
        if document.get('originalVideoPath','') and document['originalVideoPath'].endswith('.avi'):
            assert (WORK/'7-1-android.mp4').exists(),'Generate Android-compatible video first'
            document['videoPath']='videos/7-1-android.mp4'
        if document.get('videoPath'):referenced.add(document['videoPath'])
        document.pop('originalVideoPath',None)
        for animation in document['animations'].values():referenced.add(animation['path'])
        path.write_text(json.dumps(document,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    for relative in referenced:
        target=OUTPUT/relative;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(WORK/'7-1-android.mp4' if relative=='videos/7-1-android.mp4' else CONTENT/relative,target)
    active_scenes=set(frame_paths.values())
    for path in destination.glob('*.svg'):
        if 'scenes/'+path.name not in active_scenes:path.unlink()
    for path in (OUTPUT/'videos').glob('*'):
        if path.is_file() and 'videos/'+path.name not in referenced:path.unlink()
    catalog=json.loads((OUTPUT/'index/catalog.json').read_text(encoding='utf-8'))
    report={'passed':True,'questions':len(catalog['questions']),'scenes':len(frame_paths),'metafiles':len(metafiles),'sourceOperations':counts,'videos':len([x for x in referenced if x.startswith('videos/')]),'animations':len([x for x in referenced if not x.startswith('videos/')]),'librarySha256':hashlib.sha256((CONTENT/'library.json').read_bytes()).hexdigest(),'format':'SVG paths + original bitmap layers; diagram text outlined with Windows GDI; no answer screenshot substitution','videoCompatibility':'Old AVI transcoded to H.264 yuv420p CRF10/BT.709/AAC with VFR timestamps, RGB555 expanded via RGB24; original retained in desktop source; video copy is not pixel-identical'}
    (WORK/'android-content-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
if __name__=='__main__':export()
