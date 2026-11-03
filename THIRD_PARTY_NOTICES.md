# 第三方组件与素材

根目录 MIT 适用于本项目原创代码和 `samples` 原创演示，不替代下列组件及素材的许可证。安装依赖时取得的 LICENSE、NOTICE 和版权信息应继续保留。下表是主要直接依赖概览，完整依赖版本以 npm lockfile 与 Gradle 配置为准，发布二进制时还需保留其传递依赖要求的通知。

| 组件 | 用途 | 上游许可证 |
| --- | --- | --- |
| React / React DOM | Windows UI | [MIT](https://github.com/facebook/react/blob/main/LICENSE) |
| cmdk | 命令检索 | [MIT](https://github.com/dip/cmdk/blob/main/LICENSE.md) |
| GSAP / @gsap/react | 界面过渡 | [Standard No Charge GSAP License](https://gsap.com/community/standard-license/)；并非 MIT，含特定竞争用途限制 |
| Lucide | 图标 | [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE) |
| Geist（@fontsource-variable/geist） | 西文字体 | [SIL Open Font License 1.1](https://github.com/vercel/geist-font/blob/main/LICENSE.txt) |
| .NET | Windows 运行时与基础库 | [上游许可证](https://github.com/dotnet/runtime/blob/main/LICENSE.TXT)及第三方通知 |
| Microsoft WebView2 SDK / Runtime | Windows 网页宿主 | [Microsoft SDK 许可](https://www.nuget.org/packages/Microsoft.Web.WebView2)、运行时自己的许可 |
| Kotlin / kotlinx.coroutines | Android 语言与协程 | [Apache-2.0](https://github.com/JetBrains/kotlin/blob/master/license/LICENSE.txt)及各模块通知 |
| AndroidX / Compose / Media3 | Android 界面与视频 | [AndroidX 许可证](https://android.googlesource.com/platform/frameworks/support/+/androidx-main/LICENSE.txt)及各模块通知 |
| miuix 0.4.5 | Android 控件 | [Apache-2.0](https://github.com/compose-miuix-ui/miuix/blob/main/LICENSE) |
| AndroidSVG | SVG 解析 | [Apache-2.0](https://github.com/BigBadaboom/androidsvg/blob/master/LICENSE) |
| Gradle Wrapper | 获取固定构建工具 | [Apache-2.0](https://github.com/gradle/gradle/blob/master/LICENSE)；仓库包含标准生成脚本及 wrapper JAR |

开发与内容转换工具：Vite、TypeScript、Tailwind CSS、Playwright、Inno Setup、Inkscape 和 ffmpeg-static 各自适用上游许可证。`ffmpeg-static` 的 npm 包声明 GPL-3.0-or-later；该程序用于本地媒体转换，不作为阅读器运行依赖发布。源码安装命令使用 `--ignore-scripts`，普通编译无需下载 FFmpeg。

应用图标为本项目品牌素材；`support_payment.jpg` 是作者提供的收款码，仅用于原有自愿支持入口，保留其原有标识与权利，不授予冒用该收款身份的权利。

原《工程图学简明习题集》课件、原书答案、WMF/位图/视频及由其导出的 SVG/图片不采用本项目 MIT 许可证。仓库中的 `content/windows` 及 `apps/android/app/src/main/assets/content` 收录现有解包后的题目、答案、绘图过程和配套媒体，相关权利仍归原权利人，不能把这些内容标为本项目原创或重新授予 MIT 许可。`docs/screenshots` 中由项目作者提供的教材封面与软件截图，用于教材识别、界面展示和旧版对比，其中的书籍、课件内容及标识同样保留原有权利。

Readest、shadcn/ui 等仅作交互与视觉参考，没有复制其实现代码，也没有把它们的许可证标成项目许可证。
