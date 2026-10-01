import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import * as Upstream from "@thisismydesign/cursor-canvas-web";
import { BarChart } from "./bar-chart";
import { Button } from "./button";
import { LineChart } from "./line-chart";

type SetCanvasState<T> = (action: T | ((prev: T) => T)) => void;
type UseCanvasState = <T>(key: string, defaultValue: T) => [T, SetCanvasState<T>];

const CanvasFileContext = createContext("");

export function CanvasFileProvider({
	path,
	children,
}: {
	path: string;
	children: ReactNode;
}) {
	return (
		<CanvasFileContext.Provider value={path}>{children}</CanvasFileContext.Provider>
	);
}

const upstreamUseCanvasState = Upstream.useCanvasState as UseCanvasState;

function useCanvasState<T>(key: string, defaultValue: T): [T, SetCanvasState<T>] {
	const filePath = useContext(CanvasFileContext);
	const scopedKey = filePath ? `${filePath}:${key}` : key;
	return upstreamUseCanvasState(scopedKey, defaultValue);
}

/** Tests increment this from a canvas. It is not part of the Cursor canvas SDK. */
export const canvasEvaluationProbe = { count: 0 };

export const cursorCanvasApi: Record<string, unknown> = {
	...(Upstream as unknown as Record<string, unknown>),
	BarChart,
	LineChart,
	Button,
	useCanvasState,
	useState,
	useEffect,
	useMemo,
	useRef,
	canvasEvaluationProbe,
};
