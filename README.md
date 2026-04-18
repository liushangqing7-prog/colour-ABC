# Colour AAA

纯前端在线色彩处理工具（电脑端优化），支持颜色提取、调色、风格迁移与导出。

## 运行方式

1. 直接双击 `index.html` 用浏览器打开（推荐 Chrome / Edge 最新版）。
2. 或使用静态服务器：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 功能概览

- **颜色提取**
  - K-Means 主色提取（可调 K 值，支持 RGB/Lab）
  - Mean Shift 自动颜色簇提取
  - RGB 颜色直方图分析
  - PCA 主成分颜色分析
  - 聚类 + 面积筛选保留主要颜色块
- **色彩调整**
  - HSV/HSL 实时滑块调节
  - Lab（L/a/b）微调
  - 线性/非线性色彩变换（增益 + Gamma + Filmic 曲线）
  - Reinhard 色彩迁移（需目标图）
- **高级功能**
  - TensorFlow.js 简易深度学习风格迁移（通道统计 AdaIN-like）
  - 色板复制、结果图片下载
  - 明暗主题切换

## 技术栈

- HTML5 + TailwindCSS + JavaScript
- OpenCV.js（库引入，前端图像处理生态兼容）
- TensorFlow.js（简易风格迁移）

## 使用建议

- 先上传高质量原图，再运行颜色提取模块获得稳定色板。
- Reinhard 和 DL 风格迁移建议使用主题鲜明的目标图。
- 图片越大，Mean Shift 和迁移计算耗时越高，必要时可先缩放。
