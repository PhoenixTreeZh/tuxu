# 构建

所有命令从仓库根目录执行，除非注明。依赖下载需要联网；无需旧课件、私钥或维护者电脑上的 `_rea_temp`。前端 npm 依赖由 lockfile 固定，Gradle Wrapper 固定 8.13 并验证发行 ZIP 的 SHA256。

## Windows

准备 Node.js 24、.NET SDK 10.0.403（`global.json` 允许兼容的 10.0 功能版本）和 WebView2 Runtime。桌面宿主仅支持 Windows x64。

```powershell
npm --prefix apps/studio ci --ignore-scripts
npm --prefix apps/studio test
npm --prefix apps/studio run build
dotnet build apps/desktop/Studio.csproj -c Release
```

运行 `apps/desktop/bin/Release/net10.0-windows/win-x64/DrawingStudio.exe`。发布可使用：

```powershell
dotnet publish apps/desktop/Studio.csproj -c Release -o artifacts/windows
```

必须保留完整输出目录，不是只复制 EXE。输出内含原生引擎、UI 和来自 `content/windows` 的完整题库；不需要另外启动 HTTP 服务或运行原版 EXE。旧版 WinUI 工程不在本公开仓库中；`apps/windows` 的四份源码是仍在使用的共享绘图代码。

## Android

安装 JDK 21、Android SDK platform 35 与 build-tools 35.0.0；配置 `JAVA_HOME`、`ANDROID_HOME`，或用 Android Studio 配置本地 SDK。`local.properties` 不提交。

```powershell
cd apps/android
./gradlew.bat testDebugUnitTest assembleDebug --no-daemon
```

Linux/macOS 使用 `sh gradlew`；输出 `app/build/outputs/apk/debug/app-debug.apk`。默认打包仓库内 `app/src/main/assets/content` 的完整题库，包括SVG、动画与视频。设备集成测试仍需另外配置模拟器或手机，普通CI不执行设备测试。

发布构建使用 `assembleRelease`。正式签名从环境读取 `TUXU_KEYSTORE`、`TUXU_KEY_PASSWORD`，可选 `TUXU_KEY_ALIAS`、`TUXU_KEY_ALIAS_PASSWORD`；缺少正式密钥时生成未签名发布产物。不要将密钥或口令写入源码、Issue、构建日志。`build.py` 在普通克隆中调用 Wrapper 并默认构建 Debug；维护者已有本地配置时保留原发布入口。

## 测试与源码检查

```powershell
npm --prefix apps/studio test
npm --prefix apps/studio run test:content
python scripts/audit_public_source.py
python scripts/verify_content.py
python samples/generate_demo.py
```

前端独立测试使用虚构目录数据；`test:content` 使用随仓库提供的真实题库。两类测试均可在克隆后执行，CI也会运行。`scripts/verify_content.py` 检查题目、资源和引用的完整性。`verify*.mjs`、设备回归和像素比较脚本另需对应的Windows宿主或设备环境，不能把未执行的设备检查称为已通过。

Windows 原创演示的独立交互检查：把 `STUDIO_OUTPUT` 环境变量指向演示构建输出目录，然后运行 `node apps/desktop/verify-demo.mjs`。该脚本只启动并关闭自己的测试进程，核对三张不同步骤、实际图内点击、返回和滚轮缩放；测试端口已占用时拒绝连接。

`python scripts/export_public_source.py` 会创建新的 `GitHub准备/tuxu-source` 和 ZIP，复制前先扫描，已有快照不会覆盖。
