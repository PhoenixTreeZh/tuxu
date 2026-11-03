# 原创演示数据

这里的矩形、对角线和圆由 `generate_demo.py` 生成，属于本项目的 MIT 示例，不含原书题图、答案、视频或字体文件。

- 三步绘图，最后一步点击圆可打开局部，点击局部可返回。
- Windows 从几何指令重绘；Android读取同几何对应的SVG。
- 仓库默认使用完整题库；本示例保留用于独立演示和调试。示例只有1题，实际题库的207题统计不适用于它。Windows可通过TuxuContentRoot显式选择此目录；Android仅在题库目录索引缺失时使用它。

重新生成：`python samples/generate_demo.py`。
