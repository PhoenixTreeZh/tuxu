# 发布

建议仓库名 `tuxu`，分支 `main`，描述“图序：Windows / Android 离线工程图学阅读器，按章页检索、单步绘图与矢量详图”。源码采用 MIT，题库单独说明。

1. 运行构建指南中的测试、前端编译、桌面编译及 Android 调试构建。
2. 运行 `python scripts/audit_public_source.py` 和 `python scripts/verify_content.py`，确认源码及完整题库资源齐全，不包含旧EXE、私钥和用户档。
3. 用 `python scripts/export_public_source.py` 生成干净快照。在该目录初始化 Git，提交后推送到自己的公开仓库；不要直接把整套历史工作目录拖入 GitHub。
4. 首次推送后查看 Actions 的真实执行结果。本地通过不代表 GitHub 托管任务已经运行通过。
5. 如发布二进制，先确认内容分发权与第三方通知，再生成校验清单并作为 Release 附件。不要放进 Git 历史。

源码快照现在包含解包后的题目、答案和两端运行资源，默认构建完整题库版。原创代码继续使用MIT，题库与原稿素材保留原有权利，不能混作原创MIT内容。当前仍只在本地整理，导出脚本不会创建远端或自动上传，也不会把现有安装包和APK塞入源码目录。

Windows 可使用 `python apps/installer/build.py --source artifacts/windows` 构建安装器，要求 Inno Setup 7 与 Windows .NET Framework C# 编译器。默认安装目录 `%LocalAppData%/DrawingStudio`，入口请求管理员权限。程序运行档不应进入发布源目录。当前未配置受信任的代码签名身份；不能声称打包已消除 SmartScreen 提示。

Android 后续版本必须保留同一发布证书以支持覆盖升级。签名从本地环境注入，源码和 CI 不提供证书；默认 CI 不构建正式签名产物。

GitHub 普通 Git 文件超过 100 MiB 会被阻止，应使用 [Release 附件](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)分发安装包。源码包内的 `source-manifest.json` 位于快照旁，记录文件 SHA256；公开 Release 另附其实际二进制的校验文件。
