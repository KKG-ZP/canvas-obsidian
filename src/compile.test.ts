import { describe, expect, it } from "vitest";
import {
	CanvasCompileError,
	collectRequireSpecifiers,
	loadCanvasComponent,
	transformCanvasSource,
} from "./compile";

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
