<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';

	type MealData = {
		name: string;
		calories: number;
		protein: number | null;
		carbs: number | null;
		fat: number | null;
		servings: number;
	};

	type EditMealOutput = {
		success: boolean;
		previous?: MealData;
		updated?: MealData & { id: string; date: string };
		error?: string;
	};

	let { output }: { output: EditMealOutput } = $props();

	const changes = $derived(() => {
		if (!output.previous || !output.updated) return [];
		const diffs: { field: string; from: string | number; to: string | number }[] = [];

		if (output.previous.name !== output.updated.name) {
			diffs.push({ field: 'name', from: output.previous.name, to: output.updated.name });
		}
		if (output.previous.calories !== output.updated.calories) {
			diffs.push({
				field: 'calories',
				from: output.previous.calories,
				to: output.updated.calories
			});
		}
		if (output.previous.protein !== output.updated.protein) {
			diffs.push({
				field: 'protein',
				from: `${output.previous.protein ?? 0}g`,
				to: `${output.updated.protein ?? 0}g`
			});
		}
		if (output.previous.carbs !== output.updated.carbs) {
			diffs.push({
				field: 'carbs',
				from: `${output.previous.carbs ?? 0}g`,
				to: `${output.updated.carbs ?? 0}g`
			});
		}
		if (output.previous.fat !== output.updated.fat) {
			diffs.push({
				field: 'fat',
				from: `${output.previous.fat ?? 0}g`,
				to: `${output.updated.fat ?? 0}g`
			});
		}
		if (output.previous.servings !== output.updated.servings) {
			diffs.push({
				field: 'servings',
				from: output.previous.servings,
				to: output.updated.servings
			});
		}

		return diffs;
	});
</script>

{#if output.error}
	<div class="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
		{output.error}
	</div>
{:else if output.success && output.updated}
	<div class="mt-2 overflow-hidden rounded-xl border bg-card shadow-sm">
		<div class="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
			<span class="flex items-center gap-2 text-sm font-medium">
				<CheckIcon class="size-4 text-emerald-500" />
				Meal updated
			</span>
		</div>
		<div class="p-3">
			<p class="font-medium">{output.updated.name}</p>
			{#if changes().length > 0}
				<div class="mt-2 space-y-1">
					{#each changes() as change (change.field)}
						<div class="flex items-center gap-2 text-xs">
							<PencilIcon class="size-3 text-muted-foreground" />
							<span class="capitalize text-muted-foreground">{change.field}:</span>
							<span class="text-muted-foreground line-through">{change.from}</span>
							<span class="text-foreground">→</span>
							<span class="font-medium">{change.to}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
