import { describe, expect, it } from "vitest";
import {
	formatChartValue,
	referenceLineProps,
	showBarValues,
	showLineValues,
	valueAxisDomain,
} from "./chart-scale";

describe("valueAxisDomain", () => {
	it("starts at zero unless the canvas opts out", () => {
		expect(valueAxisDomain({ values: [10, 20] })).toEqual([0, 20]);
		expect(valueAxisDomain({ values: [76, 80], beginAtZero: false })).toEqual([76, 80]);
		expect(valueAxisDomain({ values: [-4, 10] })).toEqual([-4, 10]);
	});

	it("lets yMin and yMax override the automatic range", () => {
		expect(valueAxisDomain({ values: [76, 80], beginAtZero: false, yMin: 70, yMax: 90 })).toEqual([70, 90]);
	});

	it("includes a reference line that sits outside the data", () => {
		expect(valueAxisDomain({ values: [10, 20], referenceValues: [200] })).toEqual([0, 200]);
	});

	it("ignores axis controls for stacked and normalized bars", () => {
		expect(valueAxisDomain({
			values: [10, 20],
			referenceValues: [200],
			beginAtZero: false,
			yMin: 5,
			lockedToZero: true,
		})).toBeUndefined();
	});
});

describe("chart labels", () => {
	it("shows bar values automatically for one short series, and never when stacked", () => {
		expect(showBarValues({ seriesCount: 1, categoryCount: 8 })).toBe(true);
		expect(showBarValues({ seriesCount: 1, categoryCount: 9 })).toBe(false);
		expect(showBarValues({ seriesCount: 2, categoryCount: 3 })).toBe(false);
		expect(showBarValues({ seriesCount: 2, categoryCount: 3, showValues: true })).toBe(true);
		expect(showBarValues({ seriesCount: 1, categoryCount: 1, showValues: false })).toBe(false);
		expect(showBarValues({ seriesCount: 1, categoryCount: 1, showValues: true, stacked: true })).toBe(false);
		expect(showBarValues({ seriesCount: 1, categoryCount: 1, normalized: true })).toBe(false);
	});

	it("shows line values only when asked and the category count is at most 20", () => {
		expect(showLineValues(undefined, 3)).toBe(false);
		expect(showLineValues(true, 20)).toBe(true);
		expect(showLineValues(true, 21)).toBe(false);
	});

	it("applies the prefix and suffix, and drops the prefix for a normalized axis", () => {
		expect(formatChartValue(12, { prefix: "$", suffix: " ms" })).toBe("$12 ms");
		expect(formatChartValue(12, { prefix: "$", suffix: "%", normalized: true })).toBe("12%");
	});

	it("draws a reference line on the value axis", () => {
		expect(referenceLineProps([{ value: 76.32, label: "无辅助", tone: "warning" }], false, false)).toEqual([
			{ y: 76.32, color: "#E8A33D", label: "无辅助" },
		]);
		expect(referenceLineProps([{ value: 16, label: "other" }], true, false)?.[0]).toMatchObject({ x: 16, label: "other" });
		expect(referenceLineProps([{ value: 1, label: "ignored" }], false, true)).toBeUndefined();
	});
});
