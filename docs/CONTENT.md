# 题库内容与格式

现有解包后的题目、答案与配套资源已随仓库提供。Windows 数据在 `content/windows`，Android 数据在 `apps/android/app/src/main/assets/content`。两端默认使用完整题库，不需要运行原版课件或重新转换资源。

当前有207个可见入口、46套单步过程、1316个原生绘图场景和对应Android场景、14段模型动画、6个视频。部分原始中间帧不在目录中单独显示，仍完整保留在场景库中；图内详图通过热点访问，不与题目平级。

| 文件 | 职责 |
| --- | --- |
| `index/catalog.json` | 版本、章节/页、题目元数据、别名和逐题数据路径 |
| `index/questions/*.json` | 分支、步骤帧 ID、帧说明、热点、动画及媒体引用 |
| `library.json` | Windows 原生题目和场景，蛇形字段命名，版本至少 2 |
| `media/*`、`frames/*` | Windows 原 WMF/位图图层及预览帧 |
| `scenes/*.svg`、`scenes/manifest.json` | Android 路径场景与逐帧映射 |
| `animations/*`、`videos/*` | 模型动画、视频和平台兼容副本 |
| `video-compatibility.json` | Windows 旧 AVI 的兼容播放路径与校验值 |

Windows 默认选择 `content/windows`，`TuxuContentRoot` MSBuild 属性可覆盖为另一个完整目录。例如：

```powershell
dotnet publish apps/desktop/Studio.csproj -c Release -p:TuxuContentRoot=C:/MyContent/content -o artifacts/windows
```

Android 的 `apps/android/app/src/main/assets/content` 已纳入版本管理，直接打入 APK。只有该目录索引缺失时才自动使用 `samples/demo-assets`，正常克隆后不会只显示一道示例题。Windows 的原创小示例可用 `-p:TuxuContentRoot=.../samples/demo-assets/content` 显式选择。

运行 `python scripts/verify_content.py` 会检查两端目录一致性、题目与步骤、热点目标、SVG及媒体引用，并验证原生场景资源SHA256。`npm --prefix apps/studio run test:content` 检查真实题库的索引行为。校验通过表示数据和引用匹配，不代表原书答案已做学科审校，也不表示原稿空链接已经补齐。

`apps/studio/export_index.py` 可从原生库重新生成逐题索引；兼容视频映射随数据保存，重新生成不会退回旧AVI播放路径。`apps/android/export_content.py` 是可选的 SVG 重建工具，需要 Windows、本地 Inkscape 和字体轮廓转换环境，普通构建无需运行它。

原创示例位于 `samples/demo-assets/content`，可运行 `python samples/generate_demo.py` 重新生成。它只用于独立演示和调试，不含原书题目或答案。

题目元数据、文档和原生库必须来自同一套数据，热点目标必须存在，资源路径必须留在 content 内部，不能只替换一张封面或随意删除校验值。自备内容的著作权和传播权由提供者确认，不因阅读器使用 MIT 而改变。
