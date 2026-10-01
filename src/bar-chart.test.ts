import { describe, expect, it } from "vitest";
import { axisWidthForLabels } from "./bar-chart";

/** Stand-in for canvas measureText: wide glyphs and longer strings both grow. */
function measure(label: string): number {
	let width = 0;
	for (const char of label) {
		if (char.charCodeAt(0) > 255) {
			width += 12;
		} else if (char === "i" || char === "l") {
			width += 3;
		} else {
			width += 8;
		}
	}
	return width;
}

describe("axisWidthForLabels", () => {
	it("grows with the number of characters", () => {
		const short = axisWidthForLabels(["熵"], measure);
		const long = axisWidthForLabels(["对数向量化与平均"], measure);
		expect(long).toBeGreaterThan(short);
		expect(long - short).toBe(measure("对数向量化与平均") - measure("熵"));
	});

	it("grows with glyph width when the character count stays the same", () => {
		const narrow = axisWidthForLabels(["iiii"], measure);
		const wideLatin = axisWidthForLabels(["MMMM"], measure);
		const wideCjk = axisWidthForLabels(["中中中中"], measure);
		expect(wideLatin).toBeGreaterThan(narrow);
		expect(wideCjk).toBeGreaterThan(wideLatin);
	});

	it("uses only the longest label", () => {
		const mixed = axisWidthForLabels(["熵", "切向量聚合与边注意力", "交叉熵"], measure);
		expect(mixed).toBe(axisWidthForLabels(["切向量聚合与边注意力"], measure));
	});
});
