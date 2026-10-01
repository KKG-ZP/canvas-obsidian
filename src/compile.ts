import { transform } from "sucrase";
import { parse, type AnyNode } from "acorn";
import type { CanvasTrustStore } from "./trust";

export const ALLOWED_MODULES = new Set([
	"cursor/canvas",
	"react",
	"react/jsx-runtime",
	"react/jsx-dev-runtime",
]);

export class CanvasCompileError extends Error {
	override name = "CanvasCompileError";
	readonly cause?: unknown;

	constructor(message: string, options?: { cause?: unknown }) {
		super(message);
		this.cause = options?.cause;
	}
}

export type CanvasComponent = (props: Record<string, never>) => unknown;

export type CanvasRequire = (specifier: string) => unknown;

/** Names that resolve to the Obsidian window. Bound to a throwing proxy around the canvas. */
const LOCKED_GLOBALS = [
	"globalThis",
	"window",
	"self",
	"global",
	"document",
	"parent",
	"top",
	"frames",
	"Function",
	"eval",
	"process",
	"fetch",
	"XMLHttpRequest",
	"WebSocket",
	"localStorage",
	"sessionStorage",
	"navigator",
] as const;

function walkCanvas(code: string, visitNode: (node: AnyNode) => void): void {
	const ast = parse(code, { ecmaVersion: "latest", sourceType: "script" });
	function visit(node: AnyNode): void {
		visitNode(node);
		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const child of value) {
					if (child && typeof child.type === "string") visit(child as AnyNode);
				}
			} else if (value && typeof value === "object" && "type" in value) {
				visit(value as AnyNode);
			}
		}
	}
	visit(ast);
}

export function collectRequireSpecifiers(code: string): string[] {
	const specifiers: string[] = [];
	walkCanvas(code, (node) => {
		if (node.type !== "CallExpression") {
			return;
		}
		const argument = node.arguments[0];
		if (
			node.callee.type === "Identifier" && node.callee.name === "require" &&
			argument?.type === "Literal" && typeof argument.value === "string"
		) {
			specifiers.push(argument.value);
		}
	});
	return specifiers;
}

function isConstructorAccess(node: AnyNode): boolean {
	if (node.type !== "MemberExpression") {
		return false;
	}
	const property = node.property;
	if (!node.computed && property.type === "Identifier" && property.name === "constructor") {
		return true;
	}
	return node.computed && property.type === "Literal" && property.value === "constructor";
}

/** Reject syntax the require allowlist cannot see: leftover `import()` and `.constructor` escapes. */
export function assertCanvasSyntax(code: string): void {
	walkCanvas(code, (node) => {
		if (node.type === "ImportExpression") {
			throw new CanvasCompileError("Canvas cannot use dynamic import()");
		}
		if (isConstructorAccess(node)) {
			throw new CanvasCompileError("Canvas cannot read constructor");
		}
	});
}

function blockedGlobal(name: string): unknown {
	const deny = () => {
		throw new CanvasCompileError(`Canvas cannot access ${name}`);
	};
	return new Proxy(deny, {
		get: deny,
		set: deny,
		apply: deny,
		construct: deny,
	});
}

/** Literal `require("fs")` and computed `require(id)` both fail before the canvas runs. */
export function assertStaticRequires(code: string): void {
	walkCanvas(code, (node) => {
		if (node.type !== "CallExpression" || node.callee.type !== "Identifier" || node.callee.name !== "require") {
			return;
		}
		const argument = node.arguments[0];
		if (argument?.type === "Literal" && typeof argument.value === "string") {
			if (!ALLOWED_MODULES.has(argument.value)) {
				throw new CanvasCompileError(
					`Canvas may only import from "cursor/canvas" (found: ${JSON.stringify(argument.value)})`,
				);
			}
			return;
		}
		throw new CanvasCompileError("Disallowed import: dynamic require()");
	});
}

export function transformCanvasSource(source: string): string {
	try {
		const result = transform(source, {
			transforms: ["typescript", "jsx", "imports"],
			jsxRuntime: "classic",
			production: true,
			disableESTransforms: true,
		});
		return result.code;
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		throw new CanvasCompileError(`Failed to transform canvas: ${detail}`, { cause });
	}
}

export function loadCanvasComponent(
	source: string,
	requireFn: CanvasRequire,
	authorization: { path: string; trust: CanvasTrustStore },
): CanvasComponent {
	if (!authorization.trust.isTrusted(authorization.path, source)) {
		throw new CanvasCompileError("Trust this file version before executing its code");
	}
	const code = transformCanvasSource(source);
	assertCanvasSyntax(code);
	assertStaticRequires(code);

	const exports: Record<string, unknown> = {};
	const module = { exports };
	const guardedRequire: CanvasRequire = (specifier) => {
		if (!ALLOWED_MODULES.has(specifier)) {
			throw new CanvasCompileError(`Disallowed import: ${JSON.stringify(specifier)}`);
		}
		return requireFn(specifier);
	};

	let openSandbox: (...locked: unknown[]) => (
		require: CanvasRequire,
		exports: Record<string, unknown>,
		module: { exports: Record<string, unknown> },
		React: unknown,
	) => void;
	try {
		// User code runs in the inner function, so its own `const window` does not
		// collide with the locked bindings, and free `window` still hits the proxy.
		openSandbox = new Function(
			...LOCKED_GLOBALS,
			`return function(require, exports, module, React) {\n${code}\n};`,
		) as typeof openSandbox;
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		throw new CanvasCompileError(`Failed to compile canvas: ${detail}`, { cause });
	}

	let factory: ReturnType<typeof openSandbox>;
	try {
		factory = openSandbox(...LOCKED_GLOBALS.map((name) => blockedGlobal(name)));
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		throw new CanvasCompileError(`Failed to compile canvas: ${detail}`, { cause });
	}

	try {
		factory(guardedRequire, exports, module, requireFn("react"));
	} catch (cause) {
		if (cause instanceof CanvasCompileError) {
			throw cause;
		}
		const detail = cause instanceof Error ? cause.message : String(cause);
		throw new CanvasCompileError(`Failed to evaluate canvas: ${detail}`, { cause });
	}

	const component = module.exports.default ?? exports.default;
	if (typeof component !== "function") {
		throw new CanvasCompileError("Canvas must default-export a React component");
	}
	return component as CanvasComponent;
}
