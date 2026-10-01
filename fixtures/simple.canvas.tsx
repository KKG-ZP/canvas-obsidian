import { Card, CardBody, CardHeader, Stack, Stat, Table } from "cursor/canvas";

export default function SimpleReport() {
	return (
		<Stack gap={16}>
			<Stat value="42" label="Open issues" />
			<Card>
				<CardHeader>Status</CardHeader>
				<CardBody>
					<Table
						headers={["Name", "State"]}
						rows={[
							["alpha", "ready"],
							["beta", "wip"],
						]}
					/>
				</CardBody>
			</Card>
		</Stack>
	);
}
