<script lang="ts">
	import { getDisplayDate } from '$lib/utils/format';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingDownIcon from '@lucide/svelte/icons/trending-down';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';

	type ProgressOutput = {
		success: boolean;
		currentWeight?: number;
		startingWeight?: number;
		totalChange?: number;
		weightGoal?: number | null;
		remainingToGoal?: number | null;
		weeklyChange?: number | null;
		monthlyChange?: number | null;
		totalEntries?: number;
		weightUnit?: string;
		message?: string;
		error?: string;
	};

	type RecentOutput = {
		success: boolean;
		count?: number;
		entries?: Array<{ weight: number; date: string }>;
		weightUnit?: string;
		weightGoal?: number | null;
		error?: string;
	};

	let { output }: { output: ProgressOutput | RecentOutput } = $props();

	function formatChange(change: number | null | undefined, unit: string = ''): string {
		if (change === null || change === undefined) return '-';
		const prefix = change > 0 ? '+' : '';
		return `${prefix}${change}${unit ? ` ${unit}` : ''}`;
	}

	const isProgress = $derived('currentWeight' in output);
</script>

{#if output.error}
	<div class="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
		{output.error}
	</div>
{:else if 'message' in output && output.message}
	<div
		class="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
	>
		<ScaleIcon class="size-4" />
		{output.message}
	</div>
{:else if isProgress && 'currentWeight' in output && output.currentWeight}
	{@const progress = output as ProgressOutput}
	<div class="mt-2 overflow-hidden rounded-xl border bg-card shadow-sm">
		<div class="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
			<span class="flex items-center gap-2 text-sm font-medium">
				<ScaleIcon class="size-4 text-muted-foreground" />
				Progress
			</span>
			{#if progress.weightGoal}
				<div
					class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
				>
					<TargetIcon class="size-3" />
					{progress.weightGoal}
					{progress.weightUnit}
				</div>
			{/if}
		</div>
		<div class="p-3">
			<div class="flex items-baseline justify-between">
				<div>
					<span class="text-2xl font-bold tabular-nums">{progress.currentWeight}</span>
					<span class="ml-1 text-sm text-muted-foreground">{progress.weightUnit}</span>
				</div>
				{#if progress.remainingToGoal !== null && progress.remainingToGoal !== undefined}
					<span class="text-xs text-muted-foreground">
						{progress.remainingToGoal > 0 ? `${progress.remainingToGoal} to go` : 'Goal reached!'}
					</span>
				{/if}
			</div>

			<div class="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border">
				<div class="flex flex-col items-center bg-card p-2">
					<span
						class="text-sm font-medium tabular-nums {(progress.totalChange ?? 0) < 0
							? 'text-emerald-500'
							: (progress.totalChange ?? 0) > 0
								? 'text-amber-500'
								: 'text-foreground'}"
					>
						{formatChange(progress.totalChange)}
					</span>
					<span class="text-[10px] text-muted-foreground">Total</span>
				</div>
				<div class="flex flex-col items-center bg-card p-2">
					<span
						class="text-sm font-medium tabular-nums {(progress.weeklyChange ?? 0) < 0
							? 'text-emerald-500'
							: (progress.weeklyChange ?? 0) > 0
								? 'text-amber-500'
								: 'text-foreground'}"
					>
						{formatChange(progress.weeklyChange)}
					</span>
					<span class="text-[10px] text-muted-foreground">7 days</span>
				</div>
				<div class="flex flex-col items-center bg-card p-2">
					<span
						class="text-sm font-medium tabular-nums {(progress.monthlyChange ?? 0) < 0
							? 'text-emerald-500'
							: (progress.monthlyChange ?? 0) > 0
								? 'text-amber-500'
								: 'text-foreground'}"
					>
						{formatChange(progress.monthlyChange)}
					</span>
					<span class="text-[10px] text-muted-foreground">30 days</span>
				</div>
			</div>
		</div>
	</div>
{:else if 'entries' in output && output.entries && output.entries.length > 0}
	{@const recent = output as RecentOutput}
	{@const entries = recent.entries ?? []}
	<div class="mt-2 overflow-hidden rounded-xl border bg-card shadow-sm">
		<div class="border-b bg-muted/30 px-3 py-2">
			<span class="flex items-center gap-2 text-sm font-medium">
				<ScaleIcon class="size-4 text-muted-foreground" />
				Recent weigh-ins
			</span>
		</div>
		<div class="divide-y divide-border">
			{#each entries.slice(0, 5) as entry, i (entry.date)}
				{@const prevEntry = entries[i + 1]}
				{@const change = prevEntry
					? parseFloat((entry.weight - prevEntry.weight).toFixed(1))
					: null}
				<div class="flex items-center justify-between px-3 py-2">
					<span class="text-sm text-muted-foreground">{getDisplayDate(new Date(entry.date))}</span>
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium tabular-nums">{entry.weight} {recent.weightUnit}</span>
						{#if change !== null}
							<span
								class="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold {change <
								0
									? 'bg-emerald-500/10 text-emerald-500'
									: change > 0
										? 'bg-amber-500/10 text-amber-500'
										: 'bg-muted text-muted-foreground'}"
							>
								{#if change < 0}
									<TrendingDownIcon class="size-3" />
								{:else if change > 0}
									<TrendingUpIcon class="size-3" />
								{/if}
								{formatChange(change)}
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{:else if output.success}
	<div
		class="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
	>
		<ScaleIcon class="size-4" />
		No weight entries found
	</div>
{/if}
