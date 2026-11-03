#ifndef SourceDir
  #define SourceDir "..\..\新版软件\图序-React版"
#endif
#ifndef OutputDir
  #define OutputDir "..\..\安装包\Windows"
#endif

[Setup]
AppId={{76C66478-D38D-4991-B1AC-D576FC2F0B6D}
AppName=图序 · 工程图学阅读器
AppVersion=1.1.0
AppVerName=图序 1.1.0
VersionInfoDescription=图序工程图学阅读器安装程序
SetupIconFile=..\..\assets\brand\app.ico
DefaultDirName={localappdata}\DrawingStudio
UsePreviousAppDir=no
DisableDirPage=no
DefaultGroupName=图序
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#OutputDir}
OutputBaseFilename=DrawingStudio-1.1.0-win-x64-Setup
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\DrawingStudio.exe
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
CreateUninstallRegKey=CanRegisterUninstall

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "在桌面创建图序快捷方式"; GroupDescription: "快捷方式："

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "user-data\*,test-profile\*,verification\*,界面预览\*,*.pdb,*.map,*verification.json,*selfcheck.json,*startup*.json,*startup*error*.txt"

[Icons]
Name: "{group}\图序"; Filename: "{app}\DrawingStudio.exe"; WorkingDir: "{app}"; IconFilename: "{app}\DrawingStudio.exe"; Check: CanCreateStartMenu
Name: "{autodesktop}\图序"; Filename: "{app}\DrawingStudio.exe"; WorkingDir: "{app}"; IconFilename: "{app}\DrawingStudio.exe"; Tasks: desktopicon; Check: CanCreateDesktop
Name: "{app}\打开图序"; Filename: "{app}\DrawingStudio.exe"; WorkingDir: "{app}"; IconFilename: "{app}\DrawingStudio.exe"
Name: "{app}\卸载图序"; Filename: "{uninstallexe}"; WorkingDir: "{app}"; IconFilename: "{app}\DrawingStudio.exe"

[Run]
Filename: "{app}\DrawingStudio.exe"; Description: "打开图序"; Flags: nowait postinstall skipifsilent

[Code]
procedure InitializeWizard;
begin
  Log('Wizard initial installation directory=' + WizardDirValue);
end;

function CanRegisterUninstall: Boolean;
begin
  Result := GetEnv('DRAWINGSTUDIO_UNINSTALL_REGISTRY') <> '0';
end;

function CanCreateStartMenu: Boolean;
begin
  Result := GetEnv('DRAWINGSTUDIO_START_MENU') <> '0';
end;

function CanCreateDesktop: Boolean;
begin
  Result := GetEnv('DRAWINGSTUDIO_DESKTOP') <> '0';
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Target, Probe: String;
begin
  Result := '';
  Target := WizardDirValue;
  Probe := '';
  try
    if not ForceDirectories(Target) then
      RaiseException('目录无法创建');
    Probe := GenerateUniqueName(Target, '.tuxu-probe');
    if not SaveStringToFile(Probe, 'DrawingStudio write check', False) then
      RaiseException('目录无法写入');
    if not DeleteFile(Probe) then
      RaiseException('目录无法删除临时检测文件');
    Log('Install directory write check passed: ' + Target);
  except
    if Probe <> '' then DeleteFile(Probe);
    Result := '无法写入安装目录：' + Target + #13#10 +
      '请返回上一步，选择自己的可写文件夹。无需更改系统目录权限。';
    Log(Result);
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then begin
    WizardForm.FinishedLabel.Caption := WizardForm.FinishedLabel.Caption + #13#10#13#10 +
      '安装位置：' + ExpandConstant('{app}');
    if not CanRegisterUninstall then
      WizardForm.FinishedLabel.Caption := WizardForm.FinishedLabel.Caption + #13#10 +
        '系统限制了卸载列表登记，可使用安装目录内的“卸载图序”。';
    if not CanCreateStartMenu then
      WizardForm.FinishedLabel.Caption := WizardForm.FinishedLabel.Caption + #13#10 +
        '系统限制了开始菜单写入，可使用安装目录内的“打开图序”。';
  end;
end;

function WebViewInstalled: Boolean;
var Version: String;
begin
  Result := RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
  if not Result then
    Result := RegQueryStringValue(HKLM32, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  // Most Windows 11 systems have WebView2. A missing runtime is reported
  // explicitly; no security settings or browser installation are altered.
  if not WebViewInstalled then
    MsgBox('图序需要 Microsoft Edge WebView2 Runtime。若打开后提示缺少运行环境，请从微软官网下载并安装 WebView2 Evergreen Runtime。', mbInformation, MB_OK);
end;
