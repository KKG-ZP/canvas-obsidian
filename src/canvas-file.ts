import type { TAbstractFile, TFile } from "obsidian";

export const CANVAS_TSX_SUFFIX = ".canvas.tsx";

export function isCanvasTsxPath(path: string): boolean {
	return path.endsWith(CANVAS_TSX_SUFFIX);
}

export function isCanvasTsxFile(file: TAbstractFile): file is TFile {
	return "extension" in file && isCanvasTsxPath(file.path);
}
