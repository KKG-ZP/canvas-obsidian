import { describe, expect, it } from "vitest";
import {
	CanvasCompileError,
	collectRequireSpecifiers,
	loadCanvasComponent as evaluateCanvas,
	transformCanvasSource,
} from "./compile";

import { CanvasTrustStore } from "./trust";

function loadCanvasComponent(source: string, requireFn: Parameters<typeof evaluateCanvas>[1]) {
	const trust = new CanvasTrustStore();
	trust.grant("test.canvas.tsx", source);
	return evaluateCanvas(source, requireFn, { path: "test.canvas.tsx", trust });
}

const SIMPLE_CANVAS = `
import { Stack, Card, CardHeader, CardBody, Table, Stat } from "cursor/canvas";

export default function SimpleReport() {
  return (
    <Stack gap={16}>
      <Stat value="42" label="Open issues" />
      <Card>
        <CardHeader>Status</CardHeader>
        <CardBody>
          <Table
            headers={["Name", "State"]}
            rows={[["alpha", "ready"], ["beta", "wip"]]}
          />
        </CardBody>
      </Card>
    </Stack>
  );
}
`;

describe("compileCanvas", () => {
	it("loads a canvas that only imports cursor/canvas primitives", () => {
		const calls: string[] = [];
		const component = loadCanvasComponent(SIMPLE_CANVAS, (specifier) => {
			calls.push(specifier);
			if (specifier === "react") {
				return { createElement: () => null };
			}
			if (specifier === "cursor/canvas") {
				return {
					Stack: () => null,
					Card: () => null,
					CardHeader: () => null,
					CardBody: () => null,
					Table: () => null,
					Stat: () => null,
				};
			}
			throw new Error(`unexpected ${specifier}`);
		});
		expect(typeof component).toBe("function");
		expect(calls).toContain("cursor/canvas");
		expect(calls).toContain("react");
	});

	it("rejects a relative import with a readable error", () => {
		const source = `
import { Stack } from "cursor/canvas";
import helper from "./foo";

export default function Broken() {
  return <Stack>{helper}</Stack>;
}
`;
		expect(() => loadCanvasComponent(source, () => ({}))).toThrow(CanvasCompileError);
		expect(() => loadCanvasComponent(source, () => ({}))).toThrow(
			/only import from "cursor\/canvas"/,
		);
		expect(() => loadCanvasComponent(source, () => ({}))).toThrow(/\".\/foo\"/);
	});

	it("rejects a third-party import with a readable error", () => {
		const source = `
import { Stack } from "cursor/canvas";
import { something } from "lodash";

export default function Broken() {
  return <Stack>{something}</Stack>;
}
`;
		expect(() => loadCanvasComponent(source, () => ({}))).toThrow(
			/found: "lodash"/,
		);
	});

	it("strips type-only imports before the require whitelist runs", () => {
		const source = `
import type { CSSProperties } from "react";
import { Stack } from "cursor/canvas";

export default function Typed(props: { style?: CSSProperties }) {
  return <Stack style={props.style} />;
}
`;
		const code = transformCanvasSource(source);
		expect(collectRequireSpecifiers(code)).toEqual(["cursor/canvas"]);
	});
});


describe("canvas trust and import syntax", () => {
	it("does not execute global access before the exact file version is trusted", () => {
		const source = 'globalThis.__canvasExecuted = true; export default function Canvas() { return null; }';
		const trust = new CanvasTrustStore();
		const authorization = { path: "a.canvas.tsx", trust };
		const globals = globalThis as typeof globalThis & { __canvasExecuted?: boolean };
		delete globals.__canvasExecuted;
		expect(() => evaluateCanvas(source, () => ({}), authorization)).toThrow(/Trust this file version/);
		expect(globals.__canvasExecuted).toBeUndefined();
		trust.grant(authorization.path, source);
		expect(() => evaluateCanvas(source, () => ({}), authorization)).toThrow(/cannot access globalThis/);
		expect(globals.__canvasExecuted).toBeUndefined();
		delete globals.__canvasExecuted;
		expect(() => evaluateCanvas(source + "\n// changed", () => ({}), authorization)).toThrow(/Trust/);
		expect(() => evaluateCanvas(source, () => ({}), { path: "b.canvas.tsx", trust })).toThrow(/Trust/);
	});

	it("ignores comments, strings, regex literals and template text", () => {
		const code = [
			'// require("fs")',
			'/* require("path") */',
			`const text = 'require("fs")';`,
			'const pattern = /require("fs")/;',
			'const template = `require("fs")`;',
			'require /* comment */ ("react");',
		].join("\n");
		expect(collectRequireSpecifiers(code)).toEqual(["react"]);
	});

	it("checks executable calls inside template expressions and escaped literals", () => {
		expect(collectRequireSpecifiers('const text = `${require("fs")}`; require("\\x72eact");'))
			.toEqual(["fs", "react"]);
	});

	it("accepts a component displaying require text", () => {
		expect(typeof loadCanvasComponent(`export default function Canvas() { return 'require("fs")'; }`, () => ({})))
			.toBe("function");
	});

	it("guards computed require calls at evaluation time", () => {
		expect(() => loadCanvasComponent('const id = "fs"; require(id); export default function Canvas() { return null; }', () => ({})))
			.toThrow(/Disallowed import/);
	});

	it("rejects dynamic import() before the module runs", () => {
		const globals = globalThis as typeof globalThis & { __imported?: boolean };
		delete globals.__imported;
		expect(() => loadCanvasComponent(
			'export default function Canvas() { return import("fs"); }',
			() => { globals.__imported = true; return {}; },
		)).toThrow(/"fs"/);
		expect(() => loadCanvasComponent(
			'const id = "fs"; export default function Canvas() { return import(id); }',
			() => ({}),
		)).toThrow(/Disallowed import/);
		expect(globals.__imported).toBeUndefined();
	});

	it("rejects constructor access before it can reach the real Function", () => {
		const globals = globalThis as typeof globalThis & { __escaped?: boolean };
		delete globals.__escaped;
		expect(() => loadCanvasComponent(
			'const F = (() => 0).constructor; F("globalThis.__escaped = true")(); export default function Canvas() { return null; }',
			() => ({}),
		)).toThrow(/constructor/);
		expect(globals.__escaped).toBeUndefined();
	});
});
