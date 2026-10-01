// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.stubGlobal("matchMedia", vi.fn(() => ({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
	})));
	host = document.createElement("div");
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

function renderButton(disabled = false) {
	act(() => {
		root?.render(createElement(MantineProvider, null, createElement(Button, { disabled }, "当前代码 · 45,491")));
	});
	const button = host?.querySelector("button");
	expect(button).not.toBeNull();
	return button!;
}

describe("Button", () => {
	it("uses 20px type and a 1.2 line height", () => {
		const button = renderButton();
		expect(button.style.fontSize).toBe("20px");
		expect(button.style.lineHeight).toBe("1.2");
		expect(button.textContent).toBe("当前代码 · 45,491");
	});

	it("does not switch to the hover colors while disabled", () => {
		const button = renderButton(true);
		const background = button.style.background;
		act(() => { button.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); });
		expect(button.style.background).toBe(background);
		expect(button.disabled).toBe(true);
	});
});
