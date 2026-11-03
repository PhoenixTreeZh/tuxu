# 图序共用图标

来源：`apps/android/app/src/main/res/drawable/ic_launcher.xml`。深绿 `#255f49`、米白 `#f8f7f4`，完整保留两条路径、108×108视口及3单位圆角连接笔画。

`generate.py` 从Android资源生成SVG，再用项目现有Inkscape导出Windows图标；不是重新设计或替换图案。ICO含16、20、24、32、40、48、64、96、128、256十种尺寸，小尺寸为32位DIB，256为PNG。`app-icon.png`为512px预览，`app-icon.svg`供React共用。

`app.ico`接入桌面ApplicationIcon、窗口嵌入资源、Inno Setup图标和外层安装入口。快捷方式显式引用程序EXE的图标。`verify_windows.py`直接读取PE中全部图标帧，核对其字节与ICO一致。
