"""Publish the signed APK and reviewable verification records."""
from pathlib import Path
import hashlib,json,shutil,zipfile,re
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'_rea_temp/release-android';TARGET=ROOT/'安装包/Android'
def digest(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
    version=re.search(r'versionName = "([^"]+)"',(ROOT/'apps/android/app/build.gradle.kts').read_text(encoding='utf-8'))[1]
    evidence=json.loads((WORK/'android-1.1-evidence/scene-device-verification.json').read_text())
    comparison=json.loads((WORK/'android-svg-comparison.json').read_text())
    assert evidence['passed'] and evidence['renderedFrames']==1316 and evidence['videos']==6
    assert comparison['passed'] and comparison['scenes']==1316
    release_launch=json.loads((WORK/'release-launch-verification.json').read_text())
    assert release_launch['passed'] and release_launch['releaseApkInstalled'] and not release_launch['debuggable']
    assert 'OK (5 tests)' in (WORK/'android-1.1-device-tests.log').read_text(encoding='utf-8-sig')
    preservation=json.loads((WORK/'android-1.1-render-preservation.json').read_text())
    assert preservation['passed'] and preservation['identicalToPreviousVerifiedCanvasRenders']==1316
    assert release_launch['sameSignerAs1_0'] and release_launch['legacyDarkPreferenceMigrated']
    assert json.loads((WORK/'android-video-verification.json').read_text())['passed']
    unit=ET.parse(ROOT/'apps/android/app/build/test-results/testDebugUnitTest/TEST-cn.tuxu.drawing.QuestionIndexTest.xml').getroot()
    assert int(unit.attrib['tests'])==7 and int(unit.attrib['failures'])==0 and int(unit.attrib['errors'])==0
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in (WORK/'apk-signature.txt').read_text()
    assert 'android.permission.INTERNET' not in (WORK/'apk-permissions.txt').read_text()
    source=ROOT/'apps/android/app/build/outputs/apk/release/app-release.apk'
    TARGET.mkdir(parents=True,exist_ok=True);apk=TARGET/f'图序-{version}.apk';shutil.copy2(source,apk)
    assert digest(source)==digest(apk)
    assets=ROOT/'apps/android/app/src/main/assets'
    with zipfile.ZipFile(apk) as z:
        # aapt2 stores UTF-8 names without ZIP's optional UTF-8 flag. Android
        # reads those bytes as UTF-8; Python otherwise assumes legacy CP437.
        entries={}
        for info in z.infolist():
            name=info.filename
            if not info.flag_bits&0x800:
                try:name=name.encode('cp437').decode('utf-8')
                except (UnicodeEncodeError,UnicodeDecodeError):pass
            entries[name]=info
        names=set(entries)
        assert 'classes.dex' in names and 'AndroidManifest.xml' in names
        checked=0
        for item in assets.rglob('*'):
            if not item.is_file():continue
            name='assets/'+item.relative_to(assets).as_posix()
            assert name in names,name
            assert hashlib.sha256(z.read(entries[name])).hexdigest()==digest(item),name
            checked+=1
        assert not any('password.txt' in n or '.p12' in n or '.wmf' in n for n in names)
        original_qr=ROOT/'apps/android/app/src/main/res/drawable-nodpi/support_payment.jpg'
        qr_sha=digest(original_qr)
        # Release resource optimization shortens res/ names. Check original
        # bytes, rather than relying on the source filename surviving aapt2.
        assert any(info.file_size==original_qr.stat().st_size and hashlib.sha256(z.read(info)).hexdigest()==qr_sha for name,info in entries.items() if name.startswith('res/') and name.lower().endswith(('.jpg','.jpeg'))),'Original payment QR bytes missing'
    shutil.copy2(ROOT/'apps/android/README.md',TARGET/'开发与核验说明.md')
    previews=TARGET/'界面预览';previews.mkdir(exist_ok=True)
    for name in ['android-light.png','android-dark.png','android-landscape.png','android-settings.png','android-appearance.png','android-support.png','android-step-controls.png']:shutil.copy2(WORK/'android-1.1-evidence'/name,previews/name)
    report={'passed':True,'version':version,'apkSha256':digest(apk),'bytes':apk.stat().st_size,'minAndroid':'9 (API 28)','language':'Kotlin','ui':'Jetpack Compose + official upstream miuix 0.4.5','assetFilesHashChecked':checked,'device':evidence,'deviceUiTests':5,'unitTests':7,'releaseLaunch':release_launch,'renderPreservation':preservation,'originalPaymentQrPreserved':True,'features':{'settings':['dark','light','system','support','credits'],'fixedNavigation':['previousQuestion','previousStep','nextStep','nextQuestion'],'mergedUnavailableSteps':True,'nonModalFilteredBoundaryNotices':True,'fullscreen':'landscape, fitted content, stable sequence bounds, pan/pinch, return portrait, automatic rotation','emptyLinkNotice':'source info dialog, outside navigation'},'renderComparison':{k:v for k,v in comparison.items() if k!='frames'},'content':json.loads((WORK/'android-content-verification.json').read_text()),'video':json.loads((WORK/'android-video-verification.json').read_text()),'realPhoneTested':False,'scope':'API 30 emulator; no assertion of all devices or all teaching answers being audited'}
    (TARGET/'build-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (TARGET/'使用说明.txt').write_text('''图序 · Android 1.1.0

将“图序-1.1.0.apk”传到 Android 9 及以上手机，点击安装，可以覆盖升级 1.0.0。
完整离线题库，约 330 MB，包含全部视频，不需要联网或登录。

目录按章节→页→题目浏览，支持题号/页码/中文章节搜索。
底部固定为上一题、上一步、下一步、下一题；无前/后一步时由相邻翻题按钮占两格。
末步时在原位置再点即可进入下一题。筛选到底仅给短提示，不弹确认框。
若只有一个搜索结果，清空搜索后可以继续翻整章。
图上部件可点开详图，“返回”逐层返回；也可用“详图”列表。
单指拖动、双指缩放，双击或“适应”恢复全图。
“全屏”自动进入横屏：左侧题号提示，中间完整图稿，右侧导航；左上角返回竖屏。
手机横放也会自动进入此阅读页。同一绘制序列使用稳定画面范围，翻步不反复缩放跳动。
齿轮设置中可选择深色、浅色、跟随系统；支持我显示原云莓项目的微信收款码。
原稿空图片路径的提示移入“资料说明”，不挤占导航。主题、收藏、最近题目保存在本机。

原始位图仍受源像素限制。矢量来自原 WMF/文字/几何路径，并非逐步截图放大。
已在 Android 11/API 30 模拟器验证 1316 个场景、14 动画及 6 视频首帧，
并核验按钮合并、边界提示、设置与二维码、主题跟随系统、全屏缩放与图上点击。
尚未在真实手机和其他 Android 版本上验收。原书答案的学科审校仍未完成。
旧 AVI 的 H.264 兼容副本有视频编码/色度抽样差异，原片保留在项目中。
''',encoding='utf-8-sig')
    print(json.dumps({k:report[k] for k in ['passed','bytes','apkSha256','assetFilesHashChecked']},ensure_ascii=False))
if __name__=='__main__':main()
