// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.stubGlobal("matchMedia", vi.fn(() => ({
		matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
		addListener: vi.fn(), removeListener: vi.fn(),
	})));
	vi.stubGlobal("ResizeObserver", class {
		private readonly callback: ResizeObserverCallback;
		constructor(callback: ResizeObserverCallback) { this.callback = callback; }
		observe(target: Element) {
			this.callback([{
				target,
				contentRect: { width: 640, height: 320, top: 0, left: 0, bottom: 320, right: 640, x: 0, y: 0, toJSON() { return {}; } },
			} as ResizeObserverEntry], this as unknown as ResizeObserver);
		}
		unobserve() {}
		disconnect() {}
	});
	host = document.createElement("div");
	Object.defineProperty(host, "clientWidth", { value: 640 });
	Object.defineProperty(host, "clientHeight", { value: 320 });
	document.body.appendChild(host);
	root = createRoot(host);
});

afterEach(() => {
	act(() => { root?.unmount(); });
	host?.remove();
	root = null;
	host = null;
	vi.unstubAllGlobals();
});

function renderChart(chart: ReturnType<typeof createElement>) {
	act(() => {
		root?.render(createElement(MantineProvider, null, chart));
	});
}

describe("chart rendering", () => {
	it("draws bar value labels and a reference line", () => {
		renderChart(createElement(BarChart, {
			categories: ["无辅助"],
			series: [{ name: "准确率", data: [76.32] }],
			valueSuffix: "%",
			showValues: true,
			beginAtZero: false,
			referenceLines: [{ value: 76.32, label: "无辅助 76.32%" }],
		}));
		expect(host?.textContent).toContain("76.32%");
		expect(host?.textContent).toContain("无辅助 76.32%");
	});

	it("draws a line-chart reference line and point label", () => {
		renderChart(createElement(LineChart, {
			categories: ["Z1"],
			series: [{ name: "准确率", data: [0.62] }],
			beginAtZero: false,
			showValues: true,
			referenceLines: [{ value: 0.604, label: "Z1 0.604" }],
		}));
		expect(host?.textContent).toContain("Z1 0.604");
		expect(host?.textContent).toContain("0.62");
	});
});
