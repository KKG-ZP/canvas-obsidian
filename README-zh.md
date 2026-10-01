# Cursor Canvas

[English](README.md)

这个插件在 Obsidian 里打开 Cursor 画布。文件名以 `.canvas.tsx` 结尾时，按 React 组件渲染。

需要 Obsidian 1.5.0 或更高版本。

## 安装

需要 Node.js 18 或更高版本。

```bash
npm install
npm run build
```

把下面三个文件复制到库目录的 `.obsidian/plugins/cursor-canvas/`：

- `main.js`
- `styles.css`
- `manifest.json`

在 Obsidian 里打开第三方插件，启用 Cursor Canvas。列表里没有这项时，重新加载 Obsidian。

## 使用

Obsidian 只把最后一个点后面的文字当作扩展名。因此 `笔记.canvas.tsx` 的扩展名是 `tsx`。本插件匹配完整的 `.canvas.tsx` 后缀。普通 `.tsx` 仍按原来的方式打开。Obsidian 自己的 `.canvas` 白板也不会被接管。

在文件列表里点开文件即可。也可以用文件菜单中的 Open as Cursor Canvas，或命令 Open current file as Cursor Canvas。打开后直接渲染。工具栏按钮在 View source 和 View canvas 之间切换，分别显示源码和画布。

一个画布就是一个文件。它默认导出一个 React 组件，并且只能从 `cursor/canvas` 导入。数据写在文件里。插件不会读取 `~/.cursor/projects`。

`useCanvasState` 把状态存在 `localStorage`。键里包含文件路径。重命名文件后，这份状态会从头开始。

## 限制

画布在 Obsidian 进程里执行。导入只允许来自 `cursor/canvas`、`react` 和 React 的 JSX 运行时。对 `window`、`document`、`fetch` 和 `eval` 这类全局对象的直接使用会被拒绝。这层检查面向你自己写的文件。不要打开你不信任的画布。

`BarChart`、`LineChart` 和 `Button` 由本插件实现，并跟随 Obsidian 的背景色和文字色。其余 `cursor/canvas` 组件来自 [`@thisismydesign/cursor-canvas-web`](https://www.npmjs.com/package/@thisismydesign/cursor-canvas-web)（MIT）。

## 开发

```bash
npm install
npm test
npm run dev
npm run build
```

`npm run dev` 会在文件变化时重新构建。`npm run build` 会做类型检查，并打出生产包。

`main.js` 和 `styles.css` 是构建产物，已写在 `.gitignore` 里。

## 许可

MIT。见 [LICENSE](LICENSE)。
