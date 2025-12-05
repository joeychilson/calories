<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { getProfile } from '$lib/remote/profile.remote';
	import { getWeightLogs } from '$lib/remote/weight.remote';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import TrendingDownIcon from '@lucide/svelte/icons/trending-down';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import { scaleUtc } from 'd3-scale';
	import { curveMonotoneX } from 'd3-shape';
	import { Area, AreaChart, LinearGradient, Rule } from 'layerchart';
	import { SvelteDate } from 'svelte/reactivity';

	const [initialProfile, initialWeightLogs] = await Promise.all([getProfile(), getWeightLogs()]);

	const profile = $derived(getProfile().current ?? initialProfile);
	const weightLogs = $derived(getWeightLogs().current ?? initialWeightLogs);
	const units = $derived(profile?.units ?? 'imperial');
	const weightUnit = $derived(units === 'metric' ? 'kg' : 'lbs');
	const weightGoal = $derived(profile?.weightGoal ?? null);

	const chartData = $derived.by(() => {
		if (!weightLogs || weightLogs.length === 0) return [];
		return [...weightLogs]
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((log) => {
				const [year, month, day] = log.date.split('-').map(Number);
				const date = new SvelteDate(year, month - 1, day);
				return { date, weight: log.weight };
			});
	});

	const weightChange = $derived.by(() => {
		if (chartData.length < 2) return null;
		const first = chartData[0].weight;
		const last = chartData[chartData.length - 1].weight;
		return last - first;
	});

	const yDomain = $derived.by(() => {
		if (chartData.length === 0) return [0, 100];
		const weights = chartData.map((d) => d.weight);
		if (weightGoal !== null) weights.push(weightGoal);
		const min = Math.min(...weights);
		const max = Math.max(...weights);
		const padding = (max - min) * 0.15 || 5;
		return [Math.floor(min - padding), Math.ceil(max + padding)];
	});

	const xTicks = $derived.by(() => {
		if (chartData.length === 0) return [];
		const firstDate = chartData[0].date;
		const lastDate = chartData[chartData.length - 1].date;
		const days: Date[] = [];
		let currentTime = firstDate.getTime();
		const lastTime = lastDate.getTime();
		const dayMs = 24 * 60 * 60 * 1000;

		while (currentTime <= lastTime) {
			days.push(new SvelteDate(currentTime));
			currentTime += dayMs;
		}

		if (days.length <= 7) return days;
		const step = Math.ceil(days.length / 6);
		const sampled = [days[0]];
		for (let i = step; i < days.length - 1; i += step) {
			sampled.push(days[i]);
		}
		sampled.push(days[days.length - 1]);
		return sampled;
	});

	const chartConfig = {
		weight: { label: 'Weight', color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig;
</script>

<div class="flex flex-col gap-3 rounded-xl bg-muted/30 p-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
			<ScaleIcon class="size-4" />
			Weight Trend
		</div>
		{#if weightChange !== null && weightChange !== 0}
			<div
				class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold {weightChange < 0
					? 'bg-emerald-500/10 text-emerald-500'
					: 'bg-rose-500/10 text-rose-500'}"
			>
				{#if weightChange < 0}
					<TrendingDownIcon class="size-3" />
				{:else}
					<TrendingUpIcon class="size-3" />
				{/if}
				{weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)}
				{weightUnit}
			</div>
		{/if}
	</div>

	{#if chartData.length === 0}
		<div class="flex h-[180px] items-center justify-center">
			<p class="text-sm text-muted-foreground">No weight data yet</p>
		</div>
	{:else if chartData.length === 1}
		<div class="flex h-[180px] items-center justify-center">
			<p class="text-sm text-muted-foreground">Log more weight to see trends</p>
		</div>
	{:else}
		<Chart.Container config={chartConfig} class="h-[180px] w-full">
			<AreaChart
				data={chartData}
				x="date"
				xScale={scaleUtc()}
				{yDomain}
				series={[
					{
						key: 'weight',
						label: 'Weight',
						color: 'var(--color-weight)'
					}
				]}
				props={{
					area: {
						curve: curveMonotoneX,
						'fill-opacity': 0.4,
						line: { class: 'stroke-2' },
						motion: 'tween'
					},
					xAxis: {
						ticks: xTicks,
						format: (v: Date) => v.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
					},
					yAxis: {
						ticks: 3,
						format: (v: number) => `${v}`
					}
				}}
			>
				{#snippet marks({ series, getAreaProps })}
					{#if weightGoal !== null}
						<Rule y={weightGoal} stroke="#10b981" stroke-dasharray="4 4" stroke-width={1.5} />
					{/if}
					{#each series as s, i (s.key)}
						<LinearGradient
							stops={[s.color ?? '', 'color-mix(in lch, ' + s.color + ' 10%, transparent)']}
							vertical
						>
							{#snippet children({ gradient })}
								<Area {...getAreaProps(s, i)} fill={gradient} />
							{/snippet}
						</LinearGradient>
					{/each}
				{/snippet}
				{#snippet tooltip()}
					<Chart.Tooltip
						labelFormatter={(v: Date) =>
							v.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})}
						indicator="line"
					/>
				{/snippet}
			</AreaChart>
		</Chart.Container>

		{#if weightGoal !== null}
			<div class="flex items-center justify-center gap-4 text-xs text-muted-foreground">
				<div class="flex items-center gap-1.5">
					<div class="h-0.5 w-4 rounded bg-chart-1"></div>
					<span>Weight</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-0.5 w-4 rounded border-t-2 border-dashed border-emerald-500"></div>
					<span>Goal ({weightGoal} {weightUnit})</span>
				</div>
			</div>
		{/if}
	{/if}
</div>
