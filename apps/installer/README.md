# Windows 安装器

构建见 [发布指南](../../docs/RELEASING.md)。`python apps/installer/build.py --source artifacts/windows` 从完整桌面发布目录生成单个安装 EXE，需要 Inno Setup 7 与 Windows 自带的 .NET Framework C# 编译器。默认源目录是维护者既有正式软件目录；新克隆应显式传 `--source`。

外层入口内嵌并校验 Inno 载荷，为子进程设置经过写入检测的临时目录，不修改全局 TEMP、ACL 或系统安全设置。默认安装至 `%LocalAppData%/DrawingStudio`，入口请求管理员权限；阅读器自身使用普通权限。

签名身份尚未配置，当前入口仍可能显示 SmartScreen 未知发布者提示；管理员权限和制作安装包都不能替代受信任的 Authenticode 签名。见 [安全提示与签名方案](安全提示与签名方案.md)。

`verify_payload.py` 针对实际嵌入载荷检查 SHA256、安装文件和启动；执行安装/卸载测试前应使用独立测试目录。完整用户 UAC 流程仍需手工验收。公开源码导出不复制现有完整题库安装包。
