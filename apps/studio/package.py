"""Create a clean portable React desktop release without test profiles or tools."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'apps/desktop/bin/Release/net10.0-windows/win-x64'
TARGET=ROOT/'新版软件/图序-React版'
DIST=ROOT/'apps/studio/dist'

def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def copy():
    if TARGET.exists():raise RuntimeError('Delivery directory exists; refusing to replace an open reader.')
    shutil.copytree(SOURCE,TARGET,ignore=shutil.ignore_patterns('ui','test-profile','user-data','verification','*.pdb','*.xml','*.map','*startup*.json','*startup*error*.txt','startup-error.txt','studio-selfcheck.json','renderer-verification.json'))
    shutil.copytree(DIST,TARGET/'ui',ignore=shutil.ignore_patterns('*.map'))
    checked=0
    for path in TARGET.rglob('*'):
        if not path.is_file():continue
        relative=path.relative_to(TARGET)
        original=DIST/relative.relative_to('ui') if relative.parts[0]=='ui' else SOURCE/relative
        assert digest(path)==digest(original),relative
        checked+=1
    deps=(TARGET/'DrawingStudio.deps.json').read_text(encoding='utf-8')
    assert 'Microsoft.WindowsAppSDK' not in deps and 'Microsoft.UI.Xaml' not in deps
    licenses=TARGET/'第三方许可';licenses.mkdir()
    for package in ['react','react-dom','cmdk','@radix-ui/react-dialog','gsap','@gsap/react','lucide-react','@fontsource-variable/geist']:
        folder=ROOT/'apps/studio/node_modules'/package
        for item in folder.iterdir():
            if item.is_file() and item.name.lower().startswith(('license','licence','ofl')):
                shutil.copy2(item,licenses/(package.replace('/','-')+'-'+item.name))
    webview=ROOT/'_rea_temp/toolchains/nuget/microsoft.web.webview2/1.0.3179.45/LICENSE.txt'
    if webview.exists():shutil.copy2(webview,licenses/'Microsoft.WebView2-LICENSE.txt')
    (TARGET/'使用说明.txt').write_text('''图序 · 工程图学阅读器

双击 DrawingStudio.exe，移动时保留整个文件夹。
新界面使用React，不依赖WinUI。程序自带.NET运行环境，使用Windows已有的WebView2。

左侧按“章节→页→题目”浏览；Ctrl+K搜索，支持P43-1、43页、第六章 第43页 第1题。
按住左键拖动，滚轮沿鼠标位置缩放；工具栏可适应窗口、重画、进入专注模式。
图中部件可点击打开详图；返回/Esc逐层返回，也可键盘打开“图中详图”列表。
左右方向键翻步；Home/End定位首尾。最后一步之后再点同一按钮接下一题。
切题按当前筛选顺序，最后一题不循环。题图/答案/分支往返记住当前运行中的步骤和视图。
收藏、最近阅读和主题保存在本机；阅读步骤不跨启动保存，视频/GIF进度不记忆。

51页、207个主入口、46套步骤、101处静态详图、14段模型动画及6个视频。
WMF、文字和几何按当前缩放重新绘制；原位图受源像素限制。
旧AVI保留原片，界面使用经过三个RGB画面抽样核对的VP9兼容副本。
原稿空缺提示保留，全书学科答案审校、Android和其他设备验收尚未完成。
''',encoding='utf-8-sig')
    print(json.dumps({'copied':True,'filesSha256Checked':checked,'winuiDependency':False}))

def finalize():
    ui=json.loads((TARGET/'studio-selfcheck.json').read_text(encoding='utf-8-sig'))
    renderer=json.loads((TARGET/'renderer-verification.json').read_text(encoding='utf-8-sig'))
    assert ui['passed'] and renderer['passed']
    assert ui['checks']['clickableDetails']==101 and ui['checks']['animations']==14 and len(ui['checks']['videos'])==6
    assert ui['checks']['explicitRedraw'] and ui['checks']['choiceAnswers'] and ui['checks']['focusMode']
    assert ui['checks']['answerBranchMemory']
    assert ui['checks']['smoothScrubbing']['blank']==0 and ui['checks']['smoothScrubbing']['overlays']==0
    assert ui['checks']['smoothScrubbing']['displayed']==ui['checks']['smoothScrubbing']['expected']
    assert ui['checks']['themedChapterPicker']['minimumContrast']>=4.5
    startup=json.loads((TARGET/'normal-startup-verification.json').read_text(encoding='utf-8-sig'))
    assert startup['passed'] and len(startup['normalLaunches'])>=2
    assert all(case['firstDrawingVisible'] and not case['testMode'] and not case['debugPortEnabled'] for case in startup['normalLaunches'])
    shortcut=json.loads((TARGET/'shortcut-startup-verification.json').read_text(encoding='utf-8-sig'))
    assert shortcut['passed'] and shortcut['shellExecute'] and shortcut['firstDrawingVisible'] and not shortcut['testMode']
    window_frame=json.loads((TARGET/'window-frame-verification.json').read_text(encoding='utf-8-sig'))
    assert window_frame['passed'] and window_frame['checks']['allEightResizeDirections'] and window_frame['checks']['maximizeRespectsWorkingArea']
    assert renderer['all']['scenes']==1316 and renderer['vectors']['reference_mismatches']==0
    source_library=ROOT/'_rea_temp/reader/content/library.json'
    assert digest(TARGET/'content/library.json')==digest(source_library)
    keys=['DrawingStudio.exe','DrawingStudio.dll','DrawingStudio.deps.json','ui/index.html','content/library.json','content/index/catalog.json']
    report={'passed':True,'edition':'React Studio','winui':False,'coreSourceLibraryUnchanged':True,
        'hashes':{key:digest(TARGET/key) for key in keys},'uiChecks':ui,'rendererChecks':renderer,'normalStartup':startup,
        'shortcutStartup':shortcut,
        'windowFrame':window_frame,
        'index':json.loads((ROOT/'_rea_temp/frontend-rewrite/index-verification.json').read_text()),
        'videoCompatibility':json.loads((ROOT/'_rea_temp/frontend-rewrite/video-compatibility.json').read_text()),
        'contentReviewComplete':False}
    (TARGET/'build-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    previews=TARGET/'界面预览';previews.mkdir(exist_ok=True)
    for name in ['studio-main.png','studio-dark.png','studio-compact.png','studio-dark-select.png']:shutil.copy2(ROOT/'_rea_temp/frontend-rewrite'/name,previews/name)
    print(json.dumps({'passed':True,'sourcesUnchanged':True,'staticDetails':101,'animations':14,'videos':6,'scenes':1316}))

def refresh_ui():
    destination=TARGET/'ui'
    assert destination.resolve().is_relative_to(TARGET.resolve()) and destination.exists()
    shutil.copytree(DIST,destination,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.map'))
    for path in destination.rglob('*'):
        if path.is_file() and (path.suffix=='.map' or not (DIST/path.relative_to(destination)).exists()):
            path.unlink()
    assert all(digest(path)==digest(DIST/path.relative_to(destination)) for path in destination.rglob('*') if path.is_file())
    print('Refreshed and verified compiled UI assets.')

if __name__=='__main__':
    {'copy':copy,'finalize':finalize,'refresh-ui':refresh_ui}[sys.argv[1]]()
