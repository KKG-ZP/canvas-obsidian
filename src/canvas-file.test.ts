import { describe, expect, it } from "vitest";
import { isCanvasTsxPath } from "./canvas-file";

describe("isCanvasTsxPath", () => {
	it("matches Cursor canvas files only", () => {
		expect(isCanvasTsxPath("reports/status.canvas.tsx")).toBe(true);
		expect(isCanvasTsxPath("src/App.tsx")).toBe(false);
		expect(isCanvasTsxPath("board.canvas")).toBe(false);
		expect(isCanvasTsxPath("notes/ordinary.tsx")).toBe(false);
		expect(isCanvasTsxPath("graph.canvas")).toBe(false);
	});
});
