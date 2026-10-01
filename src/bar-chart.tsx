import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BarChart as MantineBarChart } from "@mantine/charts";
import { BarChart as UpstreamBarChart } from "@thisismydesign/cursor-canvas-web";

type ChartTone = "success" | "danger" | "warning" | "info" | "neutral";

type ChartSeries = {
	name: string;
	data: number[];
	tone?: ChartTone;
};

export type CanvasBarChartProps = {
	categories: string[];
	series: ChartSeries[];
	height?: number;
	stacked?: boolean;
	horizontal?: boolean;
	normalized?: boolean;
	valueSuffix?: string;
	style?: CSSProperties;
};

const TONE_COLOR: Record<ChartTone, string> = {
	success: "#1F8A65",
	danger: "#CF2D56",
	warning: "#E8A33D",
	info: "#2E79B5",
	neutral: "#8888A8",
};

const SERIES_COLORS = [
	"#1F8A65E8",
	"#70B0D8E0",
	"#5A6CC0F0",
	"#F0A040E0",
	"#C06028E0",
	"#E8C030E0",
	"#C85898E0",
	"#F0A088E0",
	"#7B64B8F0",
	"#7DCAB0E0",
	"#8888A8E0",
	"#2A9A8AE0",
];

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

export function BarChart({
	categories,
	series,
	height = 240,
	stacked,
	horizontal,
	normalized,
	valueSuffix,
	style,
}: CanvasBarChartProps) {
	if (!horizontal) {
		return (
			<UpstreamBarChart
				categories={categories}
				series={series}
				height={height}
				stacked={stacked}
				normalized={normalized}
				valueSuffix={valueSuffix}
				style={style}
			/>
		);
	}

	return (
		<HorizontalBarChart
			categories={categories}
			series={series}
			height={height}
			stacked={stacked}
			normalized={normalized}
			valueSuffix={valueSuffix}
			style={style}
		/>
	);
}

function HorizontalBarChart({
	categories,
	series,
	height = 240,
	stacked,
	normalized,
	valueSuffix,
	style,
}: CanvasBarChartProps) {
	const { probeRef, width } = useCategoryAxisWidth(categories);
	const data = categories.map((category, index) => {
		const row: Record<string, string | number> = { category };
		for (const item of series) {
			row[item.name] = item.data[index] ?? 0;
		}
		return row;
	});

	return (
		<div ref={probeRef} style={style}>
			<MantineBarChart
				h={height}
				data={data}
				dataKey="category"
				series={series.map((item, index) => ({
					name: item.name,
					color: item.tone ? TONE_COLOR[item.tone] : SERIES_COLORS[index % SERIES_COLORS.length],
				}))}
				type={normalized ? "percent" : stacked ? "stacked" : "default"}
				orientation="vertical"
				withLegend={series.length > 1}
				valueFormatter={valueSuffix ? (value) => `${value}${valueSuffix}` : undefined}
				yAxisProps={{
					width,
					tickMargin: 4,
					tick: { fontSize: TICK_FONT_SIZE_PX, fill: "currentColor" },
				}}
			/>
		</div>
	);
}
