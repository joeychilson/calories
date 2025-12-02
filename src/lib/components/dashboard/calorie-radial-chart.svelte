<script lang="ts">
	import { fade } from 'svelte/transition';

	type Meal = {
		id: string;
		name: string;
		calories: number;
		color?: string;
	};

	let {
		meals = [],
		goal = 2000,
		size = 300,
		thickness = 20
	}: {
		meals: Meal[];
		goal: number;
		size?: number;
		thickness?: number;
	} = $props();

	const CENTER = $derived(size / 2);
	const RADIUS = $derived(size / 2 - thickness);

	let segments = $derived.by(() => {
		let currentAngle = 0;
		const gapSize = meals.length > 1 ? 2 : 0;

		return meals.map((meal, i) => {
			const percentage = Math.min(meal.calories / goal, 1);
			const angleSize = percentage * 360;

			const start = currentAngle;
			const end = currentAngle + angleSize - (meals.length > 1 ? gapSize : 0);

			currentAngle += angleSize;

			return {
				...meal,
				start,
				end,
				largeArc: angleSize > 180 ? 1 : 0,
				color: `var(--chart-${(i % 5) + 1})`
			};
		});
	});

	let totalCalories = $derived(meals.reduce((acc, m) => acc + m.calories, 0));
	let remaining = $derived(Math.max(0, goal - totalCalories));

	function describeArc(startAngle: number, endAngle: number) {
		const start = polarToCartesian(CENTER, CENTER, RADIUS, endAngle);
		const end = polarToCartesian(CENTER, CENTER, RADIUS, startAngle);
		const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

		return ['M', start.x, start.y, 'A', RADIUS, RADIUS, 0, largeArcFlag, 0, end.x, end.y].join(' ');
	}

	function polarToCartesian(
		centerX: number,
		centerY: number,
		radius: number,
		angleInDegrees: number
	) {
		const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
		return {
			x: centerX + radius * Math.cos(angleInRadians),
			y: centerY + radius * Math.sin(angleInRadians)
		};
	}
</script>

<div class="relative flex items-center justify-center" style="width: {size}px; height: {size}px;">
	<svg
		width={size}
		height={size}
		viewBox="0 0 {size} {size}"
		class="rotate-0 transform transition-all duration-500 ease-out"
	>
		<circle
			cx={CENTER}
			cy={CENTER}
			r={RADIUS}
			fill="none"
			stroke="var(--muted)"
			stroke-width={thickness}
			stroke-linecap="round"
		/>
		{#each segments as segment (segment.id)}
			<path
				d={describeArc(segment.start, segment.end)}
				fill="none"
				stroke={segment.color}
				stroke-width={thickness}
				stroke-linecap="round"
				class="transition-all duration-1000 ease-out"
				in:fade={{ duration: 500 }}
			/>
		{/each}
	</svg>
	<div class="absolute inset-0 flex flex-col items-center justify-center text-center">
		<span class="text-sm font-medium text-muted-foreground">Remaining</span>
		<span class="text-4xl font-bold tracking-tighter text-foreground">{remaining}</span>
		<span class="text-xs text-muted-foreground font-medium mt-1">kcal</span>
	</div>
</div>
