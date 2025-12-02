<script lang="ts">
	import { getDisplayDate } from '$lib/utils/format';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingDownIcon from '@lucide/svelte/icons/trending-down';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';

	type LogWeightOutput = {
		success: boolean;
		updated?: boolean;
		weight: number;
		weightUnit: string;
		date: string;
		change?: number | null;
		weightGoal?: number | null;
		error?: string;
	};

	let { output }: { output: LogWeightOutput } = $props();

	const remainingToGoal = $derived(
		output.weightGoal ? parseFloat((output.weight - output.weightGoal).toFixed(1)) : null
	);
</script>

{#if output.error}
	<div class="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
		{output.error}
	</div>
{:else if output.success}
	<div class="mt-2 overflow-hidden rounded-xl border bg-card shadow-sm">
		<div class="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
			<span class="flex items-center gap-2 text-sm font-medium">
				<CheckIcon class="size-4 text-emerald-500" />
				{output.updated ? 'Weight updated' : 'Weight logged'}
			</span>
			<span class="text-xs text-muted-foreground">{getDisplayDate(new Date(output.date))}</span>
		</div>
		<div class="p-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-full bg-muted/50">
						<ScaleIcon class="size-5 text-muted-foreground" />
					</div>
					<div>
						<span class="text-xl font-bold tabular-nums">{output.weight}</span>
						<span class="ml-1 text-sm text-muted-foreground">{output.weightUnit}</span>
					</div>
				</div>

				{#if output.change !== null && output.change !== undefined}
					<div
						class="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium {output.change <
						0
							? 'bg-emerald-500/10 text-emerald-500'
							: output.change > 0
								? 'bg-amber-500/10 text-amber-500'
								: 'bg-muted text-muted-foreground'}"
					>
						{#if output.change < 0}
							<TrendingDownIcon class="size-4" />
						{:else if output.change > 0}
							<TrendingUpIcon class="size-4" />
						{/if}
						<span class="tabular-nums">{output.change > 0 ? '+' : ''}{output.change}</span>
					</div>
				{/if}
			</div>

			{#if output.weightGoal && remainingToGoal !== null}
				<div class="mt-3 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
					<TargetIcon class="size-3 text-primary" />
					{#if remainingToGoal > 0}
						<span class="text-muted-foreground">
							<span class="font-medium text-foreground">{remainingToGoal} {output.weightUnit}</span> to
							goal
						</span>
					{:else if remainingToGoal < 0}
						<span class="font-medium text-emerald-500">Goal reached!</span>
					{:else}
						<span class="font-medium text-emerald-500">At goal weight</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
