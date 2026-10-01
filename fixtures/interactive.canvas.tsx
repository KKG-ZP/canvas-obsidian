import { BarChart, Button, H1, Stack, Text, useState } from "cursor/canvas";

export default function InteractiveCanvas() {
	const [count, setCount] = useState(1);
	return (
		<Stack gap={16}>
			<H1>Interactive canvas</H1>
			<Text>Click the button; the bar chart follows the count.</Text>
			<Button onClick={() => setCount(count + 1)}>Count {count}</Button>
			<BarChart
				categories={["clicks"]}
				series={[{ name: "Count", data: [count] }]}
				height={180}
			/>
		</Stack>
	);
}
