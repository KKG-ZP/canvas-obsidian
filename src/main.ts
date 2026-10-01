import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { isCanvasTsxFile } from "./canvas-file";
import { VIEW_TYPE_CURSOR_CANVAS } from "./constants";
import { CursorCanvasView } from "./view";

type OpenFileFn = typeof WorkspaceLeaf.prototype.openFile;

export default class CursorCanvasPlugin extends Plugin {
	private originalOpenFile: OpenFileFn | null = null;
	private patchedOpenFile: OpenFileFn | null = null;

	async onload(): Promise<void> {
		this.registerView(VIEW_TYPE_CURSOR_CANVAS, (leaf) => new CursorCanvasView(leaf));
		// Obsidian hides extensions that are not registered. `.canvas.tsx` reports
		// extension `tsx`, so register that or the file explorer never lists them.
		// openFile still only renders names ending in `.canvas.tsx`.
		this.registerExtensions(["tsx"], VIEW_TYPE_CURSOR_CANVAS);
		this.patchOpenFile();

		this.addCommand({
			id: "open-cursor-canvas",
			name: "Open current file as Cursor Canvas",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !isCanvasTsxFile(file)) {
					return false;
				}
				if (!checking) {
					void this.openCanvasFile(file);
				}
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile) || !isCanvasTsxFile(file)) {
					return;
				}
				menu.addItem((item) => {
					item
						.setTitle("Open as Cursor Canvas")
						.setIcon("layout-dashboard")
						.onClick(() => {
							void this.openCanvasFile(file);
						});
				});
			}),
		);
	}

	onunload(): void {
		if (
			this.patchedOpenFile &&
			this.originalOpenFile &&
			WorkspaceLeaf.prototype.openFile === this.patchedOpenFile
		) {
			WorkspaceLeaf.prototype.openFile = this.originalOpenFile;
		}
		this.patchedOpenFile = null;
		this.originalOpenFile = null;
	}

	private patchOpenFile(): void {
		this.originalOpenFile = WorkspaceLeaf.prototype.openFile;
		const original = this.originalOpenFile;
		const plugin = this;

		const opening = new WeakSet<WorkspaceLeaf>();

		async function patchedOpenFile(
			this: WorkspaceLeaf,
			file: TFile,
			openState?: Parameters<OpenFileFn>[1],
		): Promise<void> {
			if (opening.has(this)) {
				return;
			}
			if (!isCanvasTsxFile(file)) {
				return original.call(this, file, openState);
			}
			opening.add(this);
			try {
				await this.setViewState({
					type: VIEW_TYPE_CURSOR_CANVAS,
					active: openState?.active ?? true,
					state: { file: file.path },
				});
				if (openState?.eState) {
					this.view.setEphemeralState(openState.eState);
				}
			} finally {
				opening.delete(this);
			}
		}

		this.patchedOpenFile = patchedOpenFile;
		WorkspaceLeaf.prototype.openFile = patchedOpenFile;
		plugin.register(() => {
			if (WorkspaceLeaf.prototype.openFile === patchedOpenFile) {
				WorkspaceLeaf.prototype.openFile = original;
			}
		});
	}

	private async openCanvasFile(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf();
		if (!leaf) {
			return;
		}
		await leaf.setViewState({
			type: VIEW_TYPE_CURSOR_CANVAS,
			active: true,
			state: { file: file.path },
		});
		this.app.workspace.revealLeaf(leaf);
	}
}
