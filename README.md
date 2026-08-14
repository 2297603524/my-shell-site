# 🚀 空壳网站 (Shell Site)

一个由 WorkBuddy 创建的空壳网站骨架，已部署到 GitHub Pages。

## 项目结构

```
my-shell-site/
├── index.html      # 主页面
├── css/
│   └── styles.css  # 样式文件
├── js/
│   └── script.js   # 交互脚本
└── README.md       # 项目说明
```

## 本地预览

直接用浏览器打开 `index.html`，或在项目目录启动任意静态服务器：

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

## 部署

本仓库启用了 GitHub Pages（分支 `main`，根目录）。推送到 `main` 分支后，网站会自动更新。

## 自定义

- 修改 `index.html` 添加页面内容和结构
- 修改 `css/styles.css` 调整样式
- 修改 `js/script.js` 增加交互逻辑
