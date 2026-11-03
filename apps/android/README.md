# 图序 Android

Kotlin、Jetpack Compose 与官方 miuix 0.4.5，Android 9（API 28）起。包含章页检索、单步阅读、详图、手势缩放拖动、横屏全屏、固定四格导航与齿轮设置。

使用 JDK 21、Android SDK 35。在本目录运行 `gradlew.bat testDebugUnitTest assembleDebug`，Linux/macOS 使用 `sh gradlew`。默认打包仓库内完整题库，调试构建无需正式签名证书。详细设置见 [构建指南](../../docs/BUILDING.md)。

`app/src/main/assets/content` 已包含解包后的207个题目入口、对应SVG场景、14段动画和6个视频，并纳入Git。目录缺失时才使用 `samples/demo-assets`。普通构建直接复用这些数据，无需运行 `export_content.py`；该可选重建工具需要Windows、本地Inkscape和字体轮廓转换工具。

SVG 通过 AndroidSVG / Canvas Picture 保留路径绘制；源位图仍为位图。发布应用不声明 Internet 权限。`QuestionIndexTest` 是独立检索测试；设备集成测试、SVG 对比和视频核验需要整套维护者数据与模拟器，不能直接套用到原创演示。

正式密钥只从环境或维护者既有本地配置读取，缺少时不会阻塞调试构建。更新正式 APK 应沿用原证书。
