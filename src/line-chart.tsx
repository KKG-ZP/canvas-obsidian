import type { CSSProperties } from "react";
import { AreaChart } from "@mantine/charts";
import { LineChart as MantineLineChart } from "@mantine/charts";
import {
	chartRows,
	formatChartValue,
	referenceLineProps,
	seriesColor,
	seriesValues,
	showLineValues,
	valueAxisDomain,
	type ChartReferenceLine,
	type ChartSeries,
} from "./chart-scale";

export type CanvasLineChartProps = {
	categories: string[];
	series: ChartSeries[];
	height?: number;
	fill?: boolean;
	valueSuffix?: string;
	valuePrefix?: string;
	showValues?: boolean;
	showHoverGuide?: boolean;
	beginAtZero?: boolean;
	yMin?: number;
	yMax?: number;
	referenceLines?: ChartReferenceLine[];
	style?: CSSProperties;
};

export function LineChart({
	categories,
	series,
	height = 240,
	fill,
	valueSuffix,
	valuePrefix,
	showValues,
	showHoverGuide = true,
	beginAtZero,
	yMin,
	yMax,
	referenceLines,
	style,
}: CanvasLineChartProps) {
	const domain = valueAxisDomain({
		values: seriesValues(series),
		referenceValues: referenceLines?.map((line) => line.value),
		beginAtZero,
		yMin,
		yMax,
	});
	const shared = {
		h: height,
		data: chartRows(categories, series),
		dataKey: "category" as const,
		series: series.map((item, index) => ({
			name: item.name,
			color: seriesColor(item, index),
		})),
		curveType: "monotone" as const,
		withLegend: series.length > 1,
		withPointLabels: showLineValues(showValues, categories.length),
		valueFormatter: (value: number) => formatChartValue(value, { prefix: valuePrefix, suffix: valueSuffix }),
		referenceLines: referenceLineProps(referenceLines, false, false),
		yAxisProps: domain ? { domain } : undefined,
		tooltipProps: showHoverGuide ? undefined : { cursor: false as const },
	};

	return (
		<div style={style}>
			{fill ? <AreaChart {...shared} /> : <MantineLineChart {...shared} />}
		</div>
	);
}
