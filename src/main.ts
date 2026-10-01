import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { isCanvasTsxFile } from "./canvas-file";
import { VIEW_TYPE_CURSOR_CANVAS } from "./constants";
import { CursorCanvasView } from "./view";
import { CanvasTrustStore } from "./trust";

type OpenFile = WorkspaceLeaf["openFile"];

export default class CursorCanvasPlugin extends Plugin {
	private readonly trust = new CanvasTrustStore();
	private restoreOpenFile: (() => void) | null = null;

	async onload(): Promise<void> {
		this.registerView(VIEW_TYPE_CURSOR_CANVAS, (leaf) => new CursorCanvasView(leaf, this.trust));
		// `.canvas.tsx` reports extension `tsx`. Registering that extension would
		// also claim ordinary `.tsx` files, so the file list uses a CSS override
		// and only canvas files are routed here.
		this.installOpenFilePatch();

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
		this.restoreOpenFile?.();
		this.restoreOpenFile = null;
	}

	private installOpenFilePatch(): void {
		const original = WorkspaceLeaf.prototype.openFile;
		const depth = new WeakMap<WorkspaceLeaf, number>();
		const patched: OpenFile = async function (this: WorkspaceLeaf, file, openState) {
			if (!isCanvasTsxFile(file)) {
				return original.call(this, file, openState);
			}
			const current = depth.get(this) ?? 0;
			// setViewState can re-enter openFile. Delegate that call so it is not dropped.
			if (current > 0) {
				return original.call(this, file, openState);
			}
			depth.set(this, current + 1);
			try {
				await this.setViewState({
					type: VIEW_TYPE_CURSOR_CANVAS,
					active: true,
					state: { file: file.path },
				}, openState);
			} finally {
				depth.set(this, current);
			}
		};
		WorkspaceLeaf.prototype.openFile = patched;
		this.restoreOpenFile = () => {
			if (WorkspaceLeaf.prototype.openFile === patched) {
				WorkspaceLeaf.prototype.openFile = original;
			}
		};
	}

	private async openCanvasFile(file: TFile): Promise<void> {
		const workspace = this.app.workspace;
		const leaf = workspace.getMostRecentLeaf(workspace.rootSplit) ?? workspace.getLeaf("tab");
		await leaf.openFile(file, { active: true });
		workspace.revealLeaf(leaf);
	}
}
