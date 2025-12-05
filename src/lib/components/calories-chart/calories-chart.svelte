<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { getMeals } from '$lib/remote/meals.remote';
	import { getProfile } from '$lib/remote/profile.remote';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import { scaleBand } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import { cubicInOut } from 'svelte/easing';
	import { SvelteDate } from 'svelte/reactivity';

	const [initialProfile, initialMeals] = await Promise.all([getProfile(), getMeals()]);

	const profile = $derived(getProfile().current ?? initialProfile);
	const meals = $derived(getMeals().current ?? initialMeals);
	const calorieGoal = $derived(profile?.calorieGoal ?? null);

	const chartData = $derived.by(() => {
		if (!meals || meals.length === 0) return [];

		const dailyCalories: Record<string, number> = {};
		for (const meal of meals) {
			dailyCalories[meal.date] = (dailyCalories[meal.date] ?? 0) + meal.calories;
		}

		return Object.entries(dailyCalories)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([dateStr, calories]) => {
				const [year, month, day] = dateStr.split('-').map(Number);
				const date = new SvelteDate(year, month - 1, day);
				return { date, calories };
			});
	});

	const avgCalories = $derived.by(() => {
		if (chartData.length === 0) return null;
		const total = chartData.reduce((sum, d) => sum + d.calories, 0);
		return Math.round(total / chartData.length);
	});

	const yDomain = $derived.by(() => {
		if (chartData.length === 0) return [0, 3000];
		const calories = chartData.map((d) => d.calories);
		if (calorieGoal !== null) calories.push(calorieGoal);
		const max = Math.max(...calories);
		const padding = max * 0.1 || 200;
		return [0, Math.ceil(max + padding)];
	});

	const chartConfig = {
		calories: { label: 'Calories', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;
</script>

<div class="flex flex-col gap-3 rounded-xl bg-muted/30 p-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
			<UtensilsIcon class="size-4" />
			Calorie Trend
		</div>
		{#if avgCalories !== null}
			<div class="flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-1 text-xs font-bold">
				~{avgCalories.toLocaleString()} avg
			</div>
		{/if}
	</div>

	{#if chartData.length === 0}
		<div class="flex h-[180px] items-center justify-center">
			<p class="text-sm text-muted-foreground">No meal data yet</p>
		</div>
	{:else if chartData.length === 1}
		<div class="flex h-[180px] items-center justify-center">
			<p class="text-sm text-muted-foreground">Log more meals to see trends</p>
		</div>
	{:else}
		<Chart.Container config={chartConfig} class="h-[180px] w-full">
			<BarChart
				data={chartData}
				x="date"
				xScale={scaleBand().padding(0.4)}
				y="calories"
				{yDomain}
				padding={{ left: 40, right: 8, top: 8, bottom: 24 }}
				props={{
					xAxis: {
						format: (v: Date) => v.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
					},
					yAxis: {
						ticks: 3,
						format: (v: number) => v.toLocaleString()
					},
					bars: {
						stroke: 'none',
						rounded: 'all',
						radius: 4,
						class: 'fill-chart-2',
						initialY: 0,
						initialHeight: 0,
						motion: {
							type: 'tween',
							duration: 500,
							easing: cubicInOut
						}
					},
					rule:
						calorieGoal !== null
							? {
									y: calorieGoal,
									stroke: '#10b981',
									'stroke-dasharray': '4 4',
									'stroke-width': 1.5
								}
							: undefined,
					highlight: { lines: { class: 'hidden' } }
				}}
			>
				{#snippet tooltip()}
					<Chart.Tooltip
						labelFormatter={(v: Date) =>
							v.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
						indicator="dot"
						color="var(--chart-2)"
					/>
				{/snippet}
			</BarChart>
		</Chart.Container>

		{#if calorieGoal !== null}
			<div class="flex items-center justify-center gap-4 text-xs text-muted-foreground">
				<div class="flex items-center gap-1.5">
					<div class="h-3 w-3 rounded bg-chart-2"></div>
					<span>Calories</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-0.5 w-4 rounded border-t-2 border-dashed border-emerald-500"></div>
					<span>Goal ({calorieGoal.toLocaleString()})</span>
				</div>
			</div>
		{/if}
	{/if}
</div>
