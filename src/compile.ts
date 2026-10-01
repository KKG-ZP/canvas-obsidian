import { transform } from "sucrase";

export const ALLOWED_MODULES = new Set([
	"cursor/canvas",
	"react",
	"react/jsx-runtime",
	"react/jsx-dev-runtime",
]);

const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

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

export function collectRequireSpecifiers(code: string): string[] {
	const specifiers: string[] = [];
	REQUIRE_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = REQUIRE_RE.exec(code)) !== null) {
		const specifier = match[1];
		if (specifier) {
			specifiers.push(specifier);
		}
	}
	return specifiers;
}

export function assertAllowedSpecifiers(specifiers: string[]): void {
	const illegal = [...new Set(specifiers.filter((id) => !ALLOWED_MODULES.has(id)))];
	if (illegal.length === 0) {
		return;
	}
	throw new CanvasCompileError(
		`Canvas may only import from "cursor/canvas" (found: ${illegal.map((id) => JSON.stringify(id)).join(", ")})`,
	);
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
): CanvasComponent {
	const code = transformCanvasSource(source);
	assertAllowedSpecifiers(collectRequireSpecifiers(code));

	const exports: Record<string, unknown> = {};
	const module = { exports };
	const guardedRequire: CanvasRequire = (specifier) => {
		if (!ALLOWED_MODULES.has(specifier)) {
			throw new CanvasCompileError(`Disallowed import: ${JSON.stringify(specifier)}`);
		}
		return requireFn(specifier);
	};

	let factory: (
		require: CanvasRequire,
		exports: Record<string, unknown>,
		module: { exports: Record<string, unknown> },
		React: unknown,
	) => void;
	try {
		factory = new Function(
			"require",
			"exports",
			"module",
			"React",
			code,
		) as typeof factory;
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
