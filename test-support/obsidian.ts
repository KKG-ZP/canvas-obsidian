// Minimal Obsidian surface; React and Mantine run normally in DOM tests.
export class TFile {
	constructor(public path: string) {}
	get basename() { return this.path.split("/").pop(); }
	get extension() {
		const name = this.path.split("/").pop() ?? "";
		const dot = name.lastIndexOf(".");
		return dot >= 0 ? name.slice(dot + 1) : "";
	}
}

export class WorkspaceLeaf {
	app: any;
	viewState: any = null;
	async openFile(_file: TFile, _state?: unknown): Promise<void> {}
	async setViewState(state: unknown, _openState?: unknown): Promise<void> {
		this.viewState = state;
	}
}

export class FileView {
	app: any;
	contentEl = document.createElement("div");
	file: TFile | null = null;
	navigation = false;
	constructor(leaf: WorkspaceLeaf) { this.app = leaf.app; }
	onload() {}
	registerEvent(_event: unknown) {}
	async onLoadFile(_file: TFile) {}
	async onUnloadFile(_file: TFile) {}
}

export class Plugin {
	app: any;
	views = new Map<string, unknown>();
	extensions = new Map<string, string>();
	commands: any[] = [];
	registerView(type: string, factory: unknown) { this.views.set(type, factory); }
	registerExtensions(extensions: string[], type: string) {
		for (const extension of extensions) this.extensions.set(extension, type);
	}
	addCommand(command: unknown) { this.commands.push(command); }
	registerEvent(_event: unknown) {}
}
