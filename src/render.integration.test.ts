import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { loadCanvasComponent } from "./compile";
import { CanvasFileProvider } from "./cursor-canvas-shim";
import { createCanvasRequire } from "./runtime";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function renderFixture(filename: string): string {
	const source = readFileSync(join(fixturesDir, filename), "utf8");
	const Canvas = loadCanvasComponent(source, createCanvasRequire());
	return renderToStaticMarkup(
		createElement(
			CanvasFileProvider,
			{ path: filename },
			createElement(
				MantineProvider,
				{ forceColorScheme: "light", defaultColorScheme: "light" },
				createElement(Canvas, null),
			),
		),
	);
}

describe("fixture canvases", () => {
	it("renders the Stack/Card/Table/Stat fixture", () => {
		const html = renderFixture("simple.canvas.tsx");
		expect(html).toContain("Open issues");
		expect(html).toContain("42");
		expect(html).toContain("alpha");
		expect(html).toContain("ready");
	});

	it("renders the interactive useState/BarChart fixture", () => {
		const html = renderFixture("interactive.canvas.tsx");
		expect(html).toContain("Interactive canvas");
		expect(html).toContain("Count 1");
	});
});
