"""Validate the final signature, actual upgrade and legacy theme migration."""
import hashlib,json,os,pathlib,re,subprocess,time,xml.etree.ElementTree as E
from test_device import ROOT,WORK,SDK,ENV,adb
APK=ROOT/'apps/android/app/build/outputs/apk/release/app-release.apk'
def command(arguments,output):
    result=subprocess.run(arguments,env=ENV,capture_output=True,timeout=60)
    (WORK/output).write_bytes(result.stdout+result.stderr)
    assert result.returncode==0,(result.stdout+result.stderr).decode(errors='replace')
    return result.stdout.decode('utf-8',errors='replace')
def signature(path,output):
    return command(['cmd.exe','/d','/c',str(SDK/'build-tools/35.0.0/apksigner.bat'),'verify','--verbose','--print-certs',str(path)],output)
def hierarchy():
    adb('shell','uiautomator','dump','/sdcard/tuxu-release-check.xml',check=True)
    return E.fromstring(adb('exec-out','cat','/sdcard/tuxu-release-check.xml',check=True).stdout)
def element(root,needle):
    return next((n for n in root.iter() if needle==n.get('text') or needle==n.get('content-desc')),None)
def tap(node):
    values=list(map(int,re.findall(r'\d+',node.attrib['bounds'])))
    adb('shell','input','tap',str((values[0]+values[2])//2),str((values[1]+values[3])//2),check=True);time.sleep(.25)
def start():
    p=adb('shell','am','start','-W','-n','cn.tuxu.drawing/.MainActivity',check=True)
    time.sleep(1);return p.stdout.decode(errors='replace')
def main():
    signed=signature(APK,'apk-signature.txt')
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in signed
    badging=command([str(SDK/'build-tools/35.0.0/aapt2.exe'),'dump','badging',str(APK)],'apk-badging.txt')
    assert "versionCode='2'" in badging and "versionName='1.1.0'" in badging and 'application-debuggable' not in badging
    permissions=command([str(SDK/'build-tools/35.0.0/aapt2.exe'),'dump','permissions',str(APK)],'apk-permissions.txt')
    assert 'android.permission.INTERNET' not in permissions
    old=ROOT/'安装包/Android/图序-1.0.0.apk'
    if not old.exists():old=WORK/'upgrade-fixture-1.0.0.apk'
    old_signature=signature(old,'apk-1.0-signature.txt')
    fingerprint=re.search(r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)',signed).group(1)
    assert fingerprint==re.search(r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)',old_signature).group(1)
    adb('uninstall','cn.tuxu.drawing.test');adb('uninstall','cn.tuxu.drawing')
    adb('install',str(old),check=True);start()
    for attempt in range(5):
        root=hierarchy();toggle=element(root,'深色')
        if toggle is not None:break
        time.sleep(.4)
    assert toggle is not None,'Old theme toggle missing'
    tap(toggle);assert element(hierarchy(),'浅色') is not None
    adb('install','-r',str(APK),check=True)
    launch=start();pid=adb('shell','pidof','cn.tuxu.drawing',check=True).stdout.decode().strip()
    crash=adb('logcat','-d','-b','crash','--pid='+pid,check=True).stdout.decode(errors='replace')
    assert 'FATAL EXCEPTION' not in crash
    (WORK/'android-1.1-release-launch.png').write_bytes(adb('exec-out','screencap','-p',check=True).stdout)
    node=element(hierarchy(),'设置');assert node is not None;tap(node)
    root=hierarchy()
    assert element(root,'外观') is not None and element(root,'深色') is not None,'Legacy dark preference did not migrate to explicit dark appearance'
    report={'passed':True,'version':'1.1.0','releaseApkInstalled':True,'debuggable':False,'sameSignerAs1_0':True,'legacyDarkPreferenceMigrated':True,'certificateSha256':fingerprint,'launch':launch,'crashLog':crash,'device':'Dedicated API 30 emulator','apkSha256':hashlib.sha256(APK.read_bytes()).hexdigest()}
    (WORK/'release-launch-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
if __name__=='__main__':main()
