// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, WorkspaceLeaf } from "obsidian";
import { CursorCanvasView } from "./view";
import { canvasEvaluationProbe } from "./cursor-canvas-shim";
import CursorCanvasPlugin from "./main";
import { CanvasTrustStore } from "./trust";
import { VIEW_TYPE_CURSOR_CANVAS } from "./constants";

// Obsidian adds these DOM helpers to the native element prototype.
Object.assign(HTMLElement.prototype, {
	empty() { this.replaceChildren(); },
	addClass(name: string) { this.classList.add(name); },
	setText(text: string) { this.textContent = text; },
	createDiv(options: any = {}) { return this.createEl("div", options); },
	createEl(tag: string, options: any = {}) {
		const element = document.createElement(tag);
		element.className = options.cls ?? "";
		element.textContent = options.text ?? "";
		for (const [name, value] of Object.entries(options.attr ?? {})) element.setAttribute(name, value as string);
		this.appendChild(element);
		return element;
	},
	scrollIntoView() {},
});

const views: CursorCanvasView[] = [];
const simpleSource = (label: string) => `export default function Canvas() { return <div>${label}</div>; }`;

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function setupView(source: string, trusted = true) {
	const leaf = new WorkspaceLeaf();
	const read = vi.fn().mockResolvedValue(source);
	leaf.app = { vault: { read, on: vi.fn() } };
	const trust = new CanvasTrustStore();
	const file = new TFile("a.canvas.tsx");
	if (trusted) trust.grant(file.path, source);
	const view = new CursorCanvasView(leaf, trust);
	view.file = file;
	document.body.appendChild(view.contentEl);
	views.push(view);
	return { view, file, read, trust };
}

async function load(view: CursorCanvasView, file: TFile) {
	await act(async () => { await view.onLoadFile(file); });
}

async function click(element: Element | null) {
	expect(element).not.toBeNull();
	await act(async () => { element!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.stubGlobal("matchMedia", vi.fn(() => ({
		matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
		addListener: vi.fn(), removeListener: vi.fn(),
	})));
	vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
	document.body.className = "theme-light";
});

afterEach(async () => {
	await act(async () => {
		for (const view of views.splice(0)) await (view as any).onClose();
	});
	document.body.replaceChildren();
	canvasEvaluationProbe.count = 0;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("canvas view", () => {
	it("runs a canvas as soon as it opens and reruns after edits", async () => {
		const source = `import { canvasEvaluationProbe } from "cursor/canvas"; canvasEvaluationProbe.count += 1; ${simpleSource("first")}`;
		const { view, file, read } = setupView(source, false);
		await load(view, file);
		expect(canvasEvaluationProbe.count).toBe(1);
		expect(view.contentEl.textContent).toContain("first");
		expect(view.contentEl.querySelector(".cursor-canvas-trust")).toBeNull();
		const edited = source + "\n// edited";
		read.mockResolvedValue(edited);
		await act(async () => { await (view as any).reloadFromDisk(); });
		expect(view.contentEl.textContent).toContain("first");
		expect(canvasEvaluationProbe.count).toBe(2);
		await click(view.contentEl.querySelector(".cursor-canvas-toggle"));
		expect(view.contentEl.querySelector("pre")?.textContent).toBe(edited);
		expect(canvasEvaluationProbe.count).toBe(2);
	});

	it.each([
		'export default function Canvas() { throw new Error("render failed"); }',
		'import { useEffect } from "react"; export default function Canvas() { useEffect(() => { throw new Error("render failed"); }, []); return <div>content</div>; }',
	])("shows errors from rendering and effects, then recovers after editing", async (source) => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { view, file, read, trust } = setupView(source);
		await load(view, file);
		expect(view.contentEl.querySelector(".cursor-canvas-error")?.textContent).toContain("render failed");
		const fixed = simpleSource("recovered");
		read.mockResolvedValue(fixed);
		trust.grant(file.path, fixed);
		await act(async () => { await (view as any).reloadFromDisk(); });
		expect(view.contentEl.textContent).toContain("recovered");
		expect(view.contentEl.querySelector(".cursor-canvas-error")).toBeNull();
	});

	it("preserves local state and evaluates only once across theme changes", async () => {
		const source = `import { canvasEvaluationProbe, useState } from "cursor/canvas";
		canvasEvaluationProbe.count += 1;
		export default function Canvas() {
			const [count, setCount] = useState(1);
			return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
		}`;
		const { view, file } = setupView(source);
		await load(view, file);
		await click(view.contentEl.querySelector(".cursor-canvas-mount button"));
		expect(view.contentEl.textContent).toContain("Count 2");
		await act(async () => { document.body.className = "theme-dark"; });
		expect(view.contentEl.textContent).toContain("Count 2");
		expect(canvasEvaluationProbe.count).toBe(1);
		expect(view.contentEl.querySelector(".cursor-canvas-host")?.getAttribute("data-mantine-color-scheme")).toBe("dark");
	});

	it("renders Select dropdowns inside the themed host", async () => {
		const source = `import { Select } from "cursor/canvas";
		export default function Canvas() { return <Select value="a" onChange={() => {}} options={[{value:"a",label:"Alpha"},{value:"b",label:"Beta"}]} />; }`;
		const { view, file } = setupView(source);
		await load(view, file);
		await click(view.contentEl.querySelector("input"));
		const dropdown = document.querySelector('[role="listbox"]');
		expect(dropdown).not.toBeNull();
		expect(dropdown?.closest(".cursor-canvas-host")).toBe(view.contentEl.querySelector(".cursor-canvas-host"));
		expect(dropdown?.closest(".cursor-canvas-portals")).not.toBeNull();
		await act(async () => { document.body.className = "theme-dark"; });
		expect(dropdown?.closest("[data-mantine-color-scheme]")?.getAttribute("data-mantine-color-scheme")).toBe("dark");
	});

	it.each([false, true])("discards stale reload success or failure after a file switch (failure=%s)", async (failure) => {
		const { view, file, read, trust } = setupView(simpleSource("file A"));
		await load(view, file);
		const pending = deferred<string>();
		read.mockReturnValueOnce(pending.promise);
		const reload = (view as any).reloadFromDisk();
		const next = new TFile("b.canvas.tsx");
		const nextSource = simpleSource("file B");
		trust.grant(next.path, nextSource);
		read.mockResolvedValue(nextSource);
		await act(async () => {
			await view.onUnloadFile(file);
			view.file = next;
			await view.onLoadFile(next);
		});
		await act(async () => {
			if (failure) pending.reject(new Error("old read failed"));
			else pending.resolve(simpleSource("stale A"));
			await reload;
		});
		expect(view.contentEl.textContent).toContain("file B");
		expect(view.contentEl.textContent).not.toContain("stale A");
		expect(view.contentEl.textContent).not.toContain("old read failed");
	});

	it("discards initial reads and reloads completed after closing", async () => {
		const { view, file, read, trust } = setupView(simpleSource("first"));
		const oldRead = deferred<string>();
		read.mockReturnValueOnce(oldRead.promise);
		const loading = view.onLoadFile(file);
		await Promise.resolve();
		const next = new TFile("b.canvas.tsx");
		const source = simpleSource("second");
		trust.grant(next.path, source);
		read.mockResolvedValue(source);
		view.file = next;
		await load(view, next);
		await act(async () => { oldRead.resolve(simpleSource("stale")); await loading; });
		expect(view.contentEl.textContent).toContain("second");
		const afterClose = deferred<string>();
		read.mockReturnValueOnce(afterClose.promise);
		const reload = (view as any).reloadFromDisk();
		await act(async () => { await (view as any).onClose(); });
		await act(async () => { afterClose.resolve(simpleSource("closed")); await reload; });
		expect(view.contentEl.textContent).not.toContain("closed");
	});
});

describe("native navigation", () => {
	it("opens only .canvas.tsx in the canvas view and keeps other files on the original opener", async () => {
		const opened: string[] = [];
		const original = vi.spyOn(WorkspaceLeaf.prototype, "openFile").mockImplementation(async (file: TFile) => {
			opened.push(file.path);
		});
		const plugin = new CursorCanvasPlugin();
		plugin.app = { workspace: { on: vi.fn() } };
		await plugin.onload();
		expect(plugin.extensions.has("tsx")).toBe(false);
		const leaf = new WorkspaceLeaf();
		leaf.setViewState = async function (state) {
			this.viewState = state;
			await WorkspaceLeaf.prototype.openFile.call(this, new TFile("nested.canvas.tsx"));
		};
		await leaf.openFile(new TFile("a.canvas.tsx"));
		await leaf.openFile(new TFile("ordinary.tsx"));
		await leaf.openFile(new TFile("note.md"));
		expect(leaf.viewState.state.file).toBe("a.canvas.tsx");
		expect(leaf.viewState.type).toBe(VIEW_TYPE_CURSOR_CANVAS);
		expect(opened).toEqual(["nested.canvas.tsx", "ordinary.tsx", "note.md"]);
		plugin.onunload();
		expect(WorkspaceLeaf.prototype.openFile).toBe(original);
		original.mockRestore();
	});

	it("opens a canvas in the main editor leaf", async () => {
		const plugin = new CursorCanvasPlugin();
		const root = { id: "root" };
		const editor = new WorkspaceLeaf();
		const sidebar = new WorkspaceLeaf();
		const file = new TFile("【白板】/note.canvas.tsx");
		plugin.app = {
			workspace: {
				on: vi.fn(),
				rootSplit: root,
				getActiveFile: () => file,
				getMostRecentLeaf: (scope: unknown) => scope === root ? editor : sidebar,
				getLeaf: () => sidebar,
				revealLeaf: vi.fn(),
			},
		};
		await plugin.onload();
		const command = plugin.commands.find((item) => item.id === "open-cursor-canvas");
		expect(command.checkCallback(false)).toBe(true);
		await vi.waitFor(() => expect(editor.viewState?.state.file).toBe(file.path));
		expect(sidebar.viewState).toBeNull();
		expect(editor.viewState.type).toBe(VIEW_TYPE_CURSOR_CANVAS);
		plugin.onunload();
	});
});
