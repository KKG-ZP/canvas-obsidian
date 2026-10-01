import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { scopeMantineCss } from "../scripts/scope-mantine-css.mjs";

describe("Mantine CSS scoping", () => {
	it.each([false, true])("scopes global resets and root variables with minify=%s", async (minify) => {
		const input = readFileSync("node_modules/@mantine/core/styles.css", "utf8");
		const { code } = await transform(input, { loader: "css", minify });
		const scoped = postcss.parse(scopeMantineCss(code));
		let hostRules = 0;
		scoped.walkRules((rule) => {
			for (const selector of rule.selectors) {
				expect(selector).not.toMatch(/^:root/);
				expect(selector).not.toMatch(/^(body|:root|input|button|textarea|select|\*(?:::?(before|after))?)$/);
				if (selector === ".cursor-canvas-host") hostRules++;
			}
		});
		expect(hostRules).toBeGreaterThan(2);
		expect(scoped.toString()).toContain(":where(.cursor-canvas-host) button");
		expect(scoped.toString()).toContain("--mantine-font-family");
		expect(scoped.toString()).toMatch(/\.cursor-canvas-host\[data-mantine-color-scheme=/);
	});
});
