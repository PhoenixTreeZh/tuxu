"""Run tests only on the project's dedicated emulator-5556 device."""
import argparse,json,os,pathlib,subprocess,sys,time,tarfile,io
REAL=pathlib.Path(__file__).resolve().parents[2]
ROOT=pathlib.Path(json.loads((REAL/'_rea_temp/release-android/path-alias.json').read_text(encoding='utf-8-sig'))['alias'])
WORK=ROOT/'_rea_temp/release-android';SDK=ROOT/'_rea_temp/toolchains/android-sdk';ADB=SDK/'platform-tools/adb.exe'
USER=ROOT/'_rea_temp/toolchains/android-user';JAVA=next((ROOT/'_rea_temp/toolchains/jdk21').glob('*/bin/java.exe')).parent.parent
ENV={**os.environ,'JAVA_HOME':str(JAVA),'ANDROID_HOME':str(SDK),'ANDROID_USER_HOME':str(USER/'.android'),'ANDROID_EMULATOR_HOME':str(USER/'.android'),'ANDROID_SDK_HOME':str(USER),'USERPROFILE':str(USER),'ANDROID_AVD_HOME':str(WORK/'avd'),'TEMP':str(WORK/'build-temp'),'TMP':str(WORK/'build-temp')}
def adb(*args,timeout=60,check=False):
    p=subprocess.run([str(ADB),'-s','emulator-5556',*map(str,args)],env=ENV,capture_output=True,timeout=timeout)
    if check and p.returncode:raise RuntimeError((p.stdout+p.stderr).decode('utf-8',errors='replace'))
    return p
def start():
    subprocess.run([str(ADB),'start-server'],env=ENV,capture_output=True)
    if adb('shell','getprop','sys.boot_completed').stdout.strip()==b'1':print('Project emulator ready',flush=True);return
    options=['-avd','Tuxu_API30','-no-window','-no-audio','-no-boot-anim','-no-snapshot','-gpu','swiftshader_indirect','-feature','-Vulkan','-accel','on','-memory','2048','-cores','2','-port','5556']
    startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
    with (WORK/'emulator-1.1-output.log').open('wb') as out,(WORK/'emulator-1.1-error.log').open('wb') as err:
        process=subprocess.Popen([str(SDK/'emulator/emulator.exe'),*options],env=ENV,stdout=out,stderr=err,startupinfo=startup,creationflags=subprocess.CREATE_NO_WINDOW)
    (WORK/'emulator.pid').write_text(str(process.pid))
    for attempt in range(180):
        if process.poll() is not None:raise RuntimeError('Emulator exited: '+(WORK/'emulator-1.1-error.log').read_text(errors='replace')[-2000:])
        if adb('shell','getprop','sys.boot_completed',timeout=10).stdout.strip()==b'1':print('Project emulator booted',flush=True);return
        if attempt%15==0:print('Waiting for project emulator',attempt*2,'seconds',flush=True)
        time.sleep(2)
    raise RuntimeError('Emulator did not boot within six minutes')
def install():
    apk=ROOT/'apps/android/app/build/outputs/apk/debug/app-debug.apk'
    result=adb('install','-r','-t',apk)
    if result.returncode and b'UPDATE_INCOMPATIBLE' in result.stdout+result.stderr:
        adb('uninstall','cn.tuxu.drawing.test');adb('uninstall','cn.tuxu.drawing')
        result=adb('install','-r','-t',apk)
    if result.returncode:raise RuntimeError((result.stdout+result.stderr).decode(errors='replace'))
    adb('install','-r','-t',ROOT/'apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',check=True)
    print('Installed project debug and test APKs',flush=True)
def test(full,method=None):
    classes='cn.tuxu.drawing.ReaderInteractionTest'
    if method:classes+='#'+method
    if full:classes='cn.tuxu.drawing.ReaderDeviceTest#librarySceneGraphAndVectorRedrawAreComplete,'+classes
    log=WORK/'android-1.1-device-tests.log'
    with log.open('wb') as output:
        p=subprocess.run([str(ADB),'-s','emulator-5556','shell','am','instrument','-w','-r','-e','class',classes,'cn.tuxu.drawing.test/androidx.test.runner.AndroidJUnitRunner'],env=ENV,stdout=output,stderr=subprocess.STDOUT,timeout=300)
    result=log.read_text(encoding='utf-8',errors='replace')
    print('\n'.join(line for line in result.splitlines() if any(t in line for t in ['test=','stack=','OK (','Time:','Tests run:'])),flush=True)
    if p.returncode or 'FAILURES!!!' in result or 'OK (' not in result:raise RuntimeError('Device tests failed')
def collect():
    names=['android-light.png','android-dark.png','android-landscape.png','android-settings.png','android-appearance.png','android-support.png','android-step-controls.png','scene-device-verification.json','android-svg-renders']
    data=adb('exec-out','run-as','cn.tuxu.drawing','tar','-cf','-','-C','files',*names,check=True).stdout
    target=WORK/'android-1.1-evidence';target.mkdir(exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for entry in archive.getmembers():
            assert (entry.isfile() or entry.isdir()) and (target/entry.name).resolve().is_relative_to(target.resolve())
        archive.extractall(target,filter='data')
    print('Collected previews',flush=True)
    previous=WORK/'android-evidence/android-svg-renders'
    current=target/'android-svg-renders'
    import hashlib
    old={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in previous.glob('*.png')}
    new={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in current.glob('*.png')}
    report={'passed':len(old)==1316 and old==new,'frames':len(new),'identicalToPreviousVerifiedCanvasRenders':sum(old.get(k)==v for k,v in new.items()),'scope':'Exact PNG SHA256 matches against previously checked Android Canvas renders; UI and viewport fitting changed, source drawing pixels unchanged'}
    (WORK/'android-1.1-render-preservation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report),flush=True)
    assert report['passed']
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--start',action='store_true');parser.add_argument('--ui',action='store_true');parser.add_argument('--full',action='store_true');parser.add_argument('--collect',action='store_true');parser.add_argument('--method');args=parser.parse_args()
    if args.start:start()
    if args.ui or args.full:install();test(args.full,args.method)
    if args.collect:collect()
