import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import { StrictMode, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider, type CSSVariablesResolver } from "@mantine/core";
import { isCanvasTsxPath } from "./canvas-file";
import { loadCanvasComponent } from "./compile";
import { VIEW_TYPE_CURSOR_CANVAS } from "./constants";
import { CanvasFileProvider } from "./cursor-canvas-shim";
import { createCanvasRequire } from "./runtime";

const RELOAD_DEBOUNCE_MS = 300;

const obsidianCanvasVars = {
	"--mantine-color-text": "var(--text-normal)",
	"--mantine-color-body": "var(--background-primary)",
	"--mantine-color-dimmed": "var(--text-muted)",
	"--mantine-color-default": "var(--background-primary)",
	"--mantine-color-default-hover": "var(--background-modifier-hover)",
	"--mantine-color-default-color": "var(--text-normal)",
	"--mantine-color-default-border": "var(--background-modifier-border)",
	"--mantine-color-placeholder": "var(--text-faint)",
	"--mantine-color-anchor": "var(--text-accent)",
};

const obsidianCssVariablesResolver: CSSVariablesResolver = () => ({
	variables: {
		"--mantine-font-family": "var(--font-interface)",
		"--mantine-font-family-headings": "var(--font-interface)",
	},
	light: obsidianCanvasVars,
	dark: obsidianCanvasVars,
});

function getObsidianColorScheme(): "dark" | "light" {
	return document.body.classList.contains("theme-light") ? "light" : "dark";
}

export class CursorCanvasView extends FileView {
	private root: Root | null = null;
	private hostEl: HTMLElement | null = null;
	private mountEl: HTMLElement | null = null;
	private toolbarEl: HTMLElement | null = null;
	private source = "";
	private showingSource = false;
	private reloadTimer: number | null = null;
	private themeObserver: MutationObserver | null = null;
	private colorScheme: "dark" | "light" = "dark";
	private hostId = `cursor-canvas-host-${Math.random().toString(36).slice(2, 10)}`;

	private toggleBtn: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.navigation = true;
	}

	onload(): void {
		super.onload();
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (this.file && file.path === this.file.path) {
					this.scheduleReload();
				}
			}),
		);
	}

	getViewType(): string {
		return VIEW_TYPE_CURSOR_CANVAS;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "Cursor Canvas";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	canAcceptExtension(extension: string): boolean {
		return extension === "tsx";
	}

	protected async onOpen(): Promise<void> {
		this.ensureUi();
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		this.ensureUi();
		this.source = await this.app.vault.read(file);
		this.showingSource = false;
		this.toggleBtn?.setText("View source");
		await this.renderCurrent();
	}

	async onUnloadFile(file: TFile): Promise<void> {
		this.clearReloadTimer();
		this.renderPlaceholder();
		await super.onUnloadFile(file);
	}

	protected async onClose(): Promise<void> {
		this.clearReloadTimer();
		this.themeObserver?.disconnect();
		this.themeObserver = null;
		this.root?.unmount();
		this.root = null;
		this.hostEl = null;
		this.mountEl = null;
		this.toolbarEl = null;
		this.toggleBtn = null;
	}

	private ensureUi(): void {
		if (this.root && this.mountEl) {
			return;
		}

		this.contentEl.empty();
		this.contentEl.addClass("cursor-canvas-view");

		this.toolbarEl = this.contentEl.createDiv({ cls: "cursor-canvas-toolbar" });
		this.toggleBtn = this.toolbarEl.createEl("button", {
			text: "View source",
			cls: "cursor-canvas-toggle",
		});
		this.toggleBtn.addEventListener("click", () => {
			this.showingSource = !this.showingSource;
			this.toggleBtn?.setText(this.showingSource ? "View canvas" : "View source");
			void this.renderCurrent();
		});

		this.hostEl = this.contentEl.createDiv({
			cls: "cursor-canvas-host",
			attr: { id: this.hostId },
		});
		this.mountEl = this.hostEl.createDiv({ cls: "cursor-canvas-mount" });
		this.root = createRoot(this.mountEl);
		this.colorScheme = getObsidianColorScheme();

		this.themeObserver?.disconnect();
		this.themeObserver = new MutationObserver(() => {
			const next = getObsidianColorScheme();
			if (next === this.colorScheme) {
				return;
			}
			this.colorScheme = next;
			void this.renderCurrent();
		});
		this.themeObserver.observe(document.body, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	private scheduleReload(): void {
		this.clearReloadTimer();
		this.reloadTimer = window.setTimeout(() => {
			this.reloadTimer = null;
			void this.reloadFromDisk();
		}, RELOAD_DEBOUNCE_MS);
	}

	private clearReloadTimer(): void {
		if (this.reloadTimer !== null) {
			window.clearTimeout(this.reloadTimer);
			this.reloadTimer = null;
		}
	}

	private async reloadFromDisk(): Promise<void> {
		if (!this.file) {
			return;
		}
		this.source = await this.app.vault.read(this.file);
		await this.renderCurrent();
	}

	private async renderCurrent(): Promise<void> {
		if (!this.root) {
			return;
		}
		const path = this.file?.path ?? "";
		if (this.showingSource || (path && !isCanvasTsxPath(path))) {
			this.root.render(<SourcePane source={this.source} path={path} />);
			return;
		}
		try {
			const Canvas = loadCanvasComponent(this.source, createCanvasRequire()) as ComponentType;
			this.root.render(
				<StrictMode>
					<CanvasFileProvider path={this.file?.path ?? ""}>
						<MantineProvider
							forceColorScheme={this.colorScheme}
							defaultColorScheme={this.colorScheme}
							cssVariablesSelector={`#${this.hostId}`}
							cssVariablesResolver={obsidianCssVariablesResolver}
							getRootElement={() => this.hostEl ?? document.body}
						>
							<Canvas />
						</MantineProvider>
					</CanvasFileProvider>
				</StrictMode>,
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : `Failed to render canvas: ${String(error)}`;
			this.root.render(<ErrorPane message={message} />);
		}
	}

	private renderPlaceholder(): void {
		this.root?.render(null);
	}
}

function SourcePane({ source, path }: { source: string; path: string }) {
	return (
		<div className="cursor-canvas-source">
			{path ? <div className="cursor-canvas-source-path">{path}</div> : null}
			<pre>{source}</pre>
		</div>
	);
}

function ErrorPane({ message }: { message: string }) {
	return (
		<div className="cursor-canvas-error">
			<div className="cursor-canvas-error-title">Canvas failed to render</div>
			<pre>{message}</pre>
		</div>
	);
}
