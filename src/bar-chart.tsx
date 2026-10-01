import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BarChart as MantineBarChart } from "@mantine/charts";
import {
	chartRows,
	formatChartValue,
	referenceLineProps,
	seriesColor,
	seriesValues,
	showBarValues,
	valueAxisDomain,
	type ChartReferenceLine,
	type ChartSeries,
} from "./chart-scale";

export type CanvasBarChartProps = {
	categories: string[];
	series: ChartSeries[];
	height?: number;
	stacked?: boolean;
	horizontal?: boolean;
	normalized?: boolean;
	valueSuffix?: string;
	valuePrefix?: string;
	showValues?: boolean;
	beginAtZero?: boolean;
	yMin?: number;
	yMax?: number;
	referenceLines?: ChartReferenceLine[];
	style?: CSSProperties;
};

/** Matches the tick `fontSize` Mantine draws on the category axis. */
const TICK_FONT_SIZE_PX = 12;
/** Recharts tick line plus the gap between that line and the text. */
const AXIS_INSET = 12;

/**
 * Axis width is the longest label's measured width, plus the tick inset.
 * `measure` must return that label's rendered width, so a long string of
 * narrow glyphs stays narrower than a short string of wide glyphs.
 */
export function axisWidthForLabels(
	labels: readonly string[],
	measure: (label: string) => number,
	inset = AXIS_INSET,
): number {
	let longest = 0;
	for (const label of labels) {
		longest = Math.max(longest, measure(label));
	}
	return Math.ceil(longest + inset);
}

function estimateLabel(label: string): number {
	let width = 0;
	for (const char of label) {
		width += char.charCodeAt(0) > 255 ? TICK_FONT_SIZE_PX : TICK_FONT_SIZE_PX * 0.6;
	}
	return width;
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureLabel(label: string, font: string): number {
	if (typeof document === "undefined") {
		return estimateLabel(label);
	}
	measureCanvas ??= document.createElement("canvas");
	const context = measureCanvas.getContext("2d");
	if (!context) {
		return estimateLabel(label);
	}
	context.font = font;
	return context.measureText(label).width;
}

function tickFont(family: string): string {
	return `${TICK_FONT_SIZE_PX}px ${family}`;
}

function fontFamilyOf(element: HTMLElement | null): string {
	if (element) {
		return getComputedStyle(element).fontFamily;
	}
	if (typeof document !== "undefined") {
		return getComputedStyle(document.body).fontFamily;
	}
	return "sans-serif";
}

function useCategoryAxisWidth(categories: readonly string[]) {
	const probeRef = useRef<HTMLDivElement>(null);
	const categoriesKey = categories.join("\u0000");
	const [width, setWidth] = useState(() =>
		axisWidthForLabels(categories, (label) => measureLabel(label, tickFont(fontFamilyOf(null)))),
	);

	useLayoutEffect(() => {
		const next = axisWidthForLabels(categories, (label) =>
			measureLabel(label, tickFont(fontFamilyOf(probeRef.current))),
		);
		setWidth((current) => (current === next ? current : next));
	}, [categories, categoriesKey]);

	return { probeRef, width };
}

export function BarChart(props: CanvasBarChartProps) {
	if (props.horizontal) {
		return <HorizontalBarChart {...props} />;
	}
	return (
		<div style={props.style}>
			<BarChartBody {...props} />
		</div>
	);
}

function HorizontalBarChart(props: CanvasBarChartProps) {
	const { probeRef, width } = useCategoryAxisWidth(props.categories);
	return (
		<div ref={probeRef} style={props.style}>
			<BarChartBody {...props} horizontal width={width} />
		</div>
	);
}

function BarChartBody({
	categories,
	series,
	height = 240,
	stacked,
	horizontal,
	normalized,
	valueSuffix,
	valuePrefix,
	showValues,
	beginAtZero,
	yMin,
	yMax,
	referenceLines,
	width,
}: CanvasBarChartProps & { width?: number }) {
	const locked = Boolean(stacked || normalized);
	const domain = valueAxisDomain({
		values: seriesValues(series),
		referenceValues: referenceLines?.map((line) => line.value),
		beginAtZero,
		yMin,
		yMax,
		lockedToZero: locked,
	});
	const valueAxis = domain ? { domain } : {};
	return (
		<MantineBarChart
			h={height}
			data={chartRows(categories, series)}
			dataKey="category"
			series={series.map((item, index) => ({
				name: item.name,
				color: seriesColor(item, index),
			}))}
			type={normalized ? "percent" : stacked ? "stacked" : "default"}
			orientation={horizontal ? "vertical" : "horizontal"}
			withLegend={series.length > 1}
			withBarValueLabel={showBarValues({
				showValues,
				seriesCount: series.length,
				categoryCount: categories.length,
				stacked,
				normalized,
			})}
			valueFormatter={(value) => formatChartValue(value, {
				prefix: valuePrefix,
				suffix: valueSuffix,
				normalized,
			})}
			referenceLines={referenceLineProps(referenceLines, Boolean(horizontal), locked)}
			xAxisProps={horizontal ? valueAxis : undefined}
			yAxisProps={horizontal
				? { width, tickMargin: 4, tick: { fontSize: TICK_FONT_SIZE_PX, fill: "currentColor" } }
				: valueAxis}
		/>
	);
}
