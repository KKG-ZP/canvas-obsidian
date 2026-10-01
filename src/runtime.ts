import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import * as JsxDevRuntime from "react/jsx-dev-runtime";
import { CanvasCompileError, type CanvasRequire } from "./compile";
import { cursorCanvasApi } from "./cursor-canvas-shim";

export function createCanvasRequire(): CanvasRequire {
	return (specifier) => {
		switch (specifier) {
			case "react":
				return React;
			case "react/jsx-runtime":
				return JsxRuntime;
			case "react/jsx-dev-runtime":
				return JsxDevRuntime;
			case "cursor/canvas":
				return cursorCanvasApi;
			default:
				throw new CanvasCompileError(`Disallowed import: ${JSON.stringify(specifier)}`);
		}
	};
}
