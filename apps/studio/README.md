# Windows 前端

React + TypeScript + Vite。产品控件由 React 绘制，WinForms/WebView2 负责窗口和原生绘图桥接。

构建与运行见 [根目录指南](../../README.md) 和 [构建指南](../../docs/BUILDING.md)。`npm ci --ignore-scripts`、`npm test`、`npm run build` 可以在无原题库环境执行。直接用浏览器打开页面不能调用 C# 绘图引擎。

`src/catalog.ts` 管理目录与检索；`src/store.ts` 管理筛选和阅读状态；`src/latest-task.ts` 管理绘图排队；`src/main.tsx` 展示画面和热点；`src/settings.tsx` 是设置与支持作者入口。

`npm run test:content` 使用仓库 `content/windows/index` 的真实题库索引，无需另行提取。`verify*.mjs` 是实际交互回归，需要已构建的 Windows 宿主。Playwright 从项目依赖加载，也可由 `TUXU_PLAYWRIGHT_MODULE` 指定位置。正式程序不启用测试调试端口。

索引与绘图场景分开保存；缩放通过原生引擎重新执行源绘图指令，显示缓冲不替代源矢量。内容格式见 [说明](../../docs/CONTENT.md)。
