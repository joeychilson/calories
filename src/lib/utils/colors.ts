const APP_COLORS = [
	'oklch(0.7 0.13 50)', // orange
	'oklch(0.75 0.12 85)', // yellow
	'oklch(0.7 0.12 145)', // green
	'oklch(0.65 0.10 195)', // teal
	'oklch(0.65 0.10 255)' // blue
];

const GOLDEN_ANGLE = 137.508;

export function generateChartColor(index: number): string {
	if (index < APP_COLORS.length) {
		return APP_COLORS[index];
	}
	const hue = (120 + (index - APP_COLORS.length) * GOLDEN_ANGLE) % 360;
	return `oklch(0.65 0.11 ${hue})`;
}
