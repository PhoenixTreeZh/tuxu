"""Project-local Gradle entry point, also usable from Windows PowerShell 5."""
import json,os,pathlib,subprocess,sys,shutil
REAL_ROOT=pathlib.Path(__file__).resolve().parents[2]
if not (REAL_ROOT/'_rea_temp/release-android/path-alias.json').is_file():
    project=REAL_ROOT/'apps/android'
    wrapper=project/('gradlew.bat' if os.name=='nt' else 'gradlew')
    tasks=sys.argv[1:] or ['assembleDebug']
    command=([os.environ.get('COMSPEC','cmd.exe'),'/d','/c',str(wrapper)] if os.name=='nt' else ['sh',str(wrapper)])
    raise SystemExit(subprocess.run([*command,*tasks,'--console=plain','--no-daemon'],cwd=project).returncode)
ROOT=pathlib.Path(json.loads((REAL_ROOT/'_rea_temp/release-android/path-alias.json').read_text(encoding='utf-8-sig'))['alias'])
tools=json.loads((ROOT/'_rea_temp/release-android/toolchain.json').read_text(encoding='utf-8-sig'))
user=ROOT/'_rea_temp/toolchains/android-user'
java=ROOT/'_rea_temp/toolchains/jdk21'/pathlib.PureWindowsPath(tools['java']).name
temporary=ROOT/'_rea_temp/release-android/build-temp';temporary.mkdir(exist_ok=True)
signing=ROOT/'_rea_temp/release-android/signing';signing.mkdir(exist_ok=True)
if not (signing/'password.txt').exists() or not (signing/'tuxu-release.p12').exists():
    for name in ['password.txt','tuxu-release.p12']:shutil.copy2(ROOT/'本地签名备份/Android'/name,signing/name)
secret=(signing/'password.txt').read_text(encoding='utf-8-sig').strip()
environment={**os.environ,'JAVA_HOME':str(java),'ANDROID_HOME':str(ROOT/'_rea_temp/toolchains/android-sdk'),'ANDROID_USER_HOME':str(user/'.android'),'ANDROID_PREFS_ROOT':str(user),'GRADLE_USER_HOME':str(ROOT/'_rea_temp/toolchains/gradle-cache'),'TEMP':str(temporary),'TMP':str(temporary),'TUXU_KEY_PASSWORD':secret,'PYTHONIOENCODING':'utf-8'}
gradle=ROOT/'_rea_temp/toolchains/gradle-8.13/bin/gradle.bat'
tasks=sys.argv[1:] or ['assembleRelease']
command=['cmd.exe','/d','/c',str(gradle),*tasks,'--console=plain','--no-daemon','--stacktrace','-Duser.home='+str(user)]
raise SystemExit(subprocess.run(command,cwd=ROOT/'apps/android',env=environment).returncode)
