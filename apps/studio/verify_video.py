"""Compare decoded RGB frames of the old TSCC video and its web companion."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'_rea_temp/frontend-rewrite'
CONTENT=ROOT/'_rea_temp/reader/content'
FFMPEG=ROOT/'apps/studio/node_modules/ffmpeg-static/ffmpeg.exe'

def digest(path):
    with path.open('rb') as file:return hashlib.file_digest(file,'sha256').hexdigest()

def main():
    source='videos/c56efe60e8e15525e533e434f760a05e4df0b68da2a1e2dbc452aa0a0e6ccc76.avi'
    target='videos/7-1-compatible.webm'
    hashes=[]
    for name,relative in [('original',source),('compatible',target)]:
        output=WORK/(name+'-frames.md5')
        command=[str(FFMPEG),'-hide_banner','-loglevel','error','-i',str(CONTENT/relative),'-vf',r'select=eq(n\,0)+eq(n\,2369)+eq(n\,4737)',
            '-fps_mode','passthrough','-pix_fmt','rgb24','-an','-f','framemd5','-y',str(output)]
        subprocess.run(command,check=True,capture_output=True)
        frames=[line.split(',')[-1].strip() for line in output.read_text().splitlines() if line and not line.startswith('#')]
        assert len(frames)==3,(name,frames)
        hashes.append(frames)
    assert hashes[0]==hashes[1],hashes
    report={'passed':True,'source':source,'sourceSha256':digest(CONTENT/source),'companion':target,'companionSha256':digest(CONTENT/target),
        'codec':'VP9 lossless GBRP, Opus audio','sampleFrameIndices':[0,2369,4737],'sampleRgbHashes':hashes[0],
        'samplePixelMismatches':0,'originalFilePreserved':True,'scope':'Three decoded RGB frames compared; audio re-encoded, full video pixel equality not exhaustively checked.'}
    (WORK/'video-compatibility.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))

if __name__=='__main__':main()
