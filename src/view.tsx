import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import { Component, StrictMode, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider, Portal, type CSSVariablesResolver } from "@mantine/core";
import { isCanvasTsxPath } from "./canvas-file";
import { loadCanvasComponent } from "./compile";
import { VIEW_TYPE_CURSOR_CANVAS } from "./constants";
import { CanvasFileProvider } from "./cursor-canvas-shim";
import { createCanvasRequire } from "./runtime";
import { CanvasTrustStore } from "./trust";

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
	private portalEl: HTMLElement | null = null;
	private toolbarEl: HTMLElement | null = null;
	private source = "";
	private sourceReady = false;
	private loadGeneration = 0;
	private compiled: { path: string; source: string; Canvas: ComponentType } | null = null;
	private compileError: Error | null = null;
	private componentRevision = 0;
	private showingSource = false;
	private reloadTimer: number | null = null;
	private themeObserver: MutationObserver | null = null;
	private colorScheme: "dark" | "light" = "dark";
	private hostId = `cursor-canvas-host-${Math.random().toString(36).slice(2, 10)}`;

	private toggleBtn: HTMLElement | null = null;
	private readonly reviewed = new Set<string>();

	constructor(leaf: WorkspaceLeaf, private readonly trust = new CanvasTrustStore()) {
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
		const generation = ++this.loadGeneration;
		this.clearReloadTimer();
		this.sourceReady = false;
		this.compiled = null;
		this.compileError = null;
		this.renderPlaceholder();
		await super.onLoadFile(file);
		if (generation !== this.loadGeneration || this.file !== file) return;
		this.ensureUi();
		this.showingSource = false;
		this.toggleBtn?.setText("View source");
		await this.readSource(file, generation);
	}

	async onUnloadFile(file: TFile): Promise<void> {
		++this.loadGeneration;
		this.sourceReady = false;
		this.compiled = null;
		this.compileError = null;
		this.clearReloadTimer();
		this.renderPlaceholder();
		await super.onUnloadFile(file);
	}

	protected async onClose(): Promise<void> {
		++this.loadGeneration;
		this.sourceReady = false;
		this.compiled = null;
		this.compileError = null;
		this.clearReloadTimer();
		this.themeObserver?.disconnect();
		this.themeObserver = null;
		this.root?.unmount();
		this.root = null;
		this.hostEl = null;
		this.mountEl = null;
		this.portalEl = null;
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
			if (!this.showingSource) {
				this.reviewed.add(this.reviewKey(this.file?.path ?? "", this.source));
			}
			this.showingSource = !this.showingSource;
			this.toggleBtn?.setText(this.showingSource ? "View canvas" : "View source");
			void this.renderCurrent();
		});

		this.hostEl = this.contentEl.createDiv({
			cls: "cursor-canvas-host",
			attr: { id: this.hostId },
		});
		this.mountEl = this.hostEl.createDiv({ cls: "cursor-canvas-mount" });
		this.portalEl = this.hostEl.createDiv({ cls: "cursor-canvas-portals" });
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
		await this.readSource(this.file, ++this.loadGeneration);
	}

	private async readSource(file: TFile, generation: number): Promise<void> {
		const path = file.path;
		try {
			const source = await this.app.vault.read(file);
			if (generation !== this.loadGeneration || this.file !== file || file.path !== path) return;
			if (source !== this.source) {
				this.compiled = null;
				this.compileError = null;
			}
			this.source = source;
			this.sourceReady = true;
			await this.renderCurrent();
		} catch (error) {
			if (generation !== this.loadGeneration || this.file !== file || file.path !== path) return;
			this.sourceReady = false;
			this.root?.render(<ErrorPane message={error instanceof Error ? error.message : String(error)} />);
		}
	}

	private async renderCurrent(): Promise<void> {
		if (!this.root || !this.sourceReady) {
			return;
		}
		const path = this.file?.path ?? "";
		if (this.showingSource || (path && !isCanvasTsxPath(path))) {
			this.root.render(<SourcePane source={this.source} path={path} />);
			return;
		}
		if (!this.trust.isTrusted(path, this.source)) {
			const source = this.source;
			const reviewKey = this.reviewKey(path, source);
			this.root.render(<TrustPane path={path} sourceReviewed={this.reviewed.has(reviewKey)} onTrust={() => {
				if (!this.reviewed.has(reviewKey)) return;
				if (this.file?.path !== path || this.source !== source || !this.sourceReady) return;
				this.trust.grant(path, source);
				void this.renderCurrent();
			}} />);
			return;
		}
		try {
			if (this.compiled?.path !== path || this.compiled.source !== this.source) {
				if (this.compileError) throw this.compileError;
				const Canvas = loadCanvasComponent(this.source, createCanvasRequire(), { path, trust: this.trust }) as ComponentType;
				this.compiled = { path, source: this.source, Canvas };
				++this.componentRevision;
			}
			const { Canvas } = this.compiled;
			this.root.render(
				<StrictMode>
					<CanvasErrorBoundary key={this.componentRevision}>
						<CanvasFileProvider path={path}>
							<MantineProvider
								forceColorScheme={this.colorScheme}
								defaultColorScheme={this.colorScheme}
								cssVariablesSelector={`#${this.hostId}`}
								cssVariablesResolver={obsidianCssVariablesResolver}
								getRootElement={() => this.hostEl ?? document.body}
								theme={{
									components: {
										Portal: Portal.extend({ defaultProps: { target: this.portalEl! } }),
									},
								}}
							>
								<Canvas />
							</MantineProvider>
						</CanvasFileProvider>
					</CanvasErrorBoundary>
				</StrictMode>,
			);
		} catch (error) {
			this.compileError = error instanceof Error ? error : new Error(String(error));
			const message =
				error instanceof Error ? error.message : `Failed to render canvas: ${String(error)}`;
			this.root.render(<ErrorPane message={message} />);
		}
	}

	private renderPlaceholder(): void {
		this.root?.render(null);
	}

	private reviewKey(path: string, source: string): string {
		return `${path}\0${source}`;
	}
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
	state: { error: Error | null } = { error: null };

	static getDerivedStateFromError(error: unknown): { error: Error } {
		return { error: error instanceof Error ? error : new Error(String(error)) };
	}

	render(): ReactNode {
		return this.state.error ? <ErrorPane message={this.state.error.message} /> : this.props.children;
	}
}

function TrustPane({
	path,
	sourceReviewed,
	onTrust,
}: {
	path: string;
	sourceReviewed: boolean;
	onTrust: () => void;
}) {
	return (
		<div className="cursor-canvas-trust">
			<p>{path}</p>
			<p>This file runs as JavaScript inside Obsidian. View the source, then trust this exact version for this session.</p>
			<button type="button" disabled={!sourceReviewed} onClick={() => {
				if (sourceReviewed) onTrust();
			}}>
				{sourceReviewed ? "Trust and run this version for this session" : "View source before trusting"}
			</button>
		</div>
	);
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
