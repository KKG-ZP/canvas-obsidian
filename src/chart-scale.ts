export type ChartTone = "success" | "danger" | "warning" | "info" | "neutral";

export type ChartSeries = {
	name: string;
	data: number[];
	tone?: ChartTone;
};

export type ChartReferenceLine = {
	value: number;
	label?: string;
	tone?: ChartTone;
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

export function seriesColor(series: ChartSeries, index: number): string {
	const color = series.tone ? TONE_COLOR[series.tone] : SERIES_COLORS[index % SERIES_COLORS.length];
	return color ?? "#8888A8";
}

export function chartRows(categories: readonly string[], series: readonly ChartSeries[]): Record<string, string | number>[] {
	return categories.map((category, index) => {
		const row: Record<string, string | number> = { category };
		for (const item of series) {
			row[item.name] = item.data[index] ?? 0;
		}
		return row;
	});
}

export function seriesValues(series: readonly ChartSeries[]): number[] {
	return series.flatMap((item) => item.data);
}

/**
 * Value-axis domain. `beginAtZero` defaults to true, so a plot of 10..20
 * still starts at 0. `yMin` / `yMax` win over that default. Reference-line
 * values are included so a target above the bars stays on the chart.
 * Stacked and normalized bars ignore these controls and keep a zero baseline.
 */
export function valueAxisDomain(input: {
	values: readonly number[];
	referenceValues?: readonly number[];
	beginAtZero?: boolean;
	yMin?: number;
	yMax?: number;
	lockedToZero?: boolean;
}): [number, number] | undefined {
	if (input.lockedToZero) {
		return undefined;
	}
	const samples = finite(input.values);
	const refs = finite(input.referenceValues ?? []);
	const dataLow = samples.length ? Math.min(...samples) : 0;
	const dataHigh = samples.length ? Math.max(...samples) : 0;
	const low = refs.length ? Math.min(dataLow, ...refs) : dataLow;
	const high = refs.length ? Math.max(dataHigh, ...refs) : dataHigh;
	const beginAtZero = input.beginAtZero !== false;
	const min = input.yMin !== undefined ? input.yMin : beginAtZero ? Math.min(0, low) : low;
	let max = input.yMax !== undefined ? input.yMax : high;
	if (input.yMax === undefined && max === min) {
		max = min + 1;
	}
	return [min, max];
}

/** Bar labels. Auto-on for one series and at most eight categories. Never on stacked or normalized bars. */
export function showBarValues(input: {
	showValues?: boolean;
	seriesCount: number;
	categoryCount: number;
	stacked?: boolean;
	normalized?: boolean;
}): boolean {
	if (input.stacked || input.normalized) {
		return false;
	}
	if (input.showValues === false) {
		return false;
	}
	if (input.showValues === true) {
		return true;
	}
	return input.seriesCount === 1 && input.categoryCount <= 8;
}

/** Point labels only when requested, and only up to 20 categories. */
export function showLineValues(showValues: boolean | undefined, categoryCount: number): boolean {
	return showValues === true && categoryCount <= 20;
}

/** `valuePrefix` is omitted in normalized mode, where the axis is a share of 100%. */
export function formatChartValue(
	value: number,
	options: { prefix?: string; suffix?: string; normalized?: boolean },
): string {
	const prefix = options.normalized ? "" : options.prefix ?? "";
	return `${prefix}${value}${options.suffix ?? ""}`;
}

/** Horizontal bars measure the value on X, so the reference line is vertical. */
export function referenceLineProps(
	lines: readonly ChartReferenceLine[] | undefined,
	horizontal: boolean,
	lockedToZero: boolean,
): { x?: number; y?: number; color?: string; label?: string }[] | undefined {
	if (lockedToZero || !lines?.length) {
		return undefined;
	}
	return lines.map((line) => ({
		...(horizontal ? { x: line.value } : { y: line.value }),
		color: line.tone ? TONE_COLOR[line.tone] : undefined,
		label: line.label,
	}));
}

function finite(values: readonly number[]): number[] {
	return values.filter((value) => Number.isFinite(value));
}
