<script lang="ts">
	import { formatTime, getDisplayDate, parseLocalDate } from '$lib/utils/format';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';

	type Meal = {
		id: string;
		name: string;
		calories: number;
		protein: number | null;
		carbs: number | null;
		fat: number | null;
		servings: number;
		mealDate: string;
		mealTime: string;
	};

	type QueryOutput = {
		success: boolean;
		count?: number;
		meals?: Meal[];
		totals?: {
			calories: number;
			protein: number;
			carbs: number;
			fat: number;
		};
		error?: string;
	};

	let { output }: { output: QueryOutput } = $props();
</script>

{#if output.error}
	<div class="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
		{output.error}
	</div>
{:else if output.meals && output.meals.length > 0}
	<div class="mt-2 overflow-hidden rounded-xl border bg-card shadow-sm">
		<div class="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
			<span class="flex items-center gap-2 text-sm font-medium">
				<UtensilsIcon class="size-4 text-muted-foreground" />
				{output.count} meal{output.count !== 1 ? 's' : ''}
			</span>
			{#if output.totals}
				<div
					class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
				>
					<FlameIcon class="size-3" />
					{output.totals.calories}
				</div>
			{/if}
		</div>
		<div class="divide-y divide-border">
			{#each output.meals.slice(0, 5) as meal (meal.id)}
				<div class="flex items-center gap-3 px-3 py-2">
					<div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
						<UtensilsIcon class="size-4 text-muted-foreground/50" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{meal.name}</p>
						<p class="text-[11px] text-muted-foreground">
							{getDisplayDate(parseLocalDate(meal.mealDate))} at {formatTime(
								new Date(meal.mealTime).getTime()
							)}
						</p>
					</div>
					<div class="flex shrink-0 items-center gap-1">
						<span
							class="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500 dark:text-blue-400"
						>
							{meal.protein ?? 0}g P
						</span>
						<div class="flex items-baseline gap-0.5 rounded-lg bg-foreground/5 px-2 py-1">
							<span class="text-sm font-bold tabular-nums">{meal.calories}</span>
						</div>
					</div>
				</div>
			{/each}
			{#if output.meals.length > 5}
				<div class="bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
					+{output.meals.length - 5} more
				</div>
			{/if}
		</div>
	</div>
{:else if output.success}
	<div
		class="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
	>
		<UtensilsIcon class="size-4" />
		No meals found
	</div>
{/if}
