<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import TargetIcon from '@lucide/svelte/icons/target';

	type UpdateGoalsOutput = {
		success: boolean;
		updated?: {
			calorieGoal?: number;
			weightGoal?: number | null;
		};
		error?: string;
	};

	type UpdateGoalsInput = {
		calorieGoal?: number;
		weightGoal?: number;
	};

	let {
		input,
		output
	}: {
		input: UpdateGoalsInput;
		output?: UpdateGoalsOutput;
	} = $props();
</script>

{#if output?.error}
	<div class="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
		{output.error}
	</div>
{:else if output?.success}
	<div class="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
		<CheckIcon class="size-4 text-emerald-500" />
		<span class="text-muted-foreground">Updated</span>
		{#if input.calorieGoal}
			<span
				class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
			>
				<FlameIcon class="size-3" />
				{input.calorieGoal} kcal
			</span>
		{/if}
		{#if input.weightGoal}
			<span
				class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
			>
				<TargetIcon class="size-3" />
				{input.weightGoal}
			</span>
		{/if}
	</div>
{/if}
