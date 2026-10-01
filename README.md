# Cursor Canvas

[中文](README-zh.md)

An Obsidian plugin that opens Cursor canvas files as live React views. A canvas file name must end with `.canvas.tsx`.

Requires Obsidian 1.5.0 or later.

## Install

Requires Node.js 18 or later.

```bash
npm install
npm run build
```

Copy these three files into `<vault>/.obsidian/plugins/cursor-canvas/`:

- `main.js`
- `styles.css`
- `manifest.json`

Turn on community plugins in Obsidian, then enable **Cursor Canvas**. Reload Obsidian if the plugin is missing from the list.

## Use

Obsidian treats only the text after the last dot as the extension, so `note.canvas.tsx` has the extension `tsx`. This plugin matches the full `.canvas.tsx` suffix. Ordinary `.tsx` files stay with their normal opener. Obsidian's own `.canvas` whiteboards are left alone.

Open the file from the file explorer. You can also use **Open as Cursor Canvas** in the file menu, or the command **Open current file as Cursor Canvas**. The canvas runs as soon as it opens. The toolbar button switches between **View source** and **View canvas**.

A canvas is one file. It default-exports a React component and imports only from `cursor/canvas`. Keep data in the file. The plugin does not read `~/.cursor/projects`.

`useCanvasState` stores values in `localStorage`. The key includes the file path, so renaming the file starts that state over.

## Limits

The canvas runs inside Obsidian. Imports are limited to `cursor/canvas`, `react`, and the React JSX runtimes. Direct use of `window`, `document`, `fetch`, `eval`, and similar globals is rejected. That check is meant for files you wrote. Do not open a canvas you do not trust.

`BarChart`, `LineChart`, and `Button` are implemented in this plugin and follow Obsidian's background and text colors. Other `cursor/canvas` components come from [`@thisismydesign/cursor-canvas-web`](https://www.npmjs.com/package/@thisismydesign/cursor-canvas-web) (MIT).

## Develop

```bash
npm install
npm test
npm run dev
npm run build
```

`npm run dev` rebuilds when files change. `npm run build` typechecks and writes a production bundle.

`main.js` and `styles.css` are build outputs and are listed in `.gitignore`.

## License

MIT. See [LICENSE](LICENSE).
