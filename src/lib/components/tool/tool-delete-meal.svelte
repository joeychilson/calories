<script lang="ts">
	import FlameIcon from '@lucide/svelte/icons/flame';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	type DeleteMealOutput = {
		success: boolean;
		deleted?: {
			id: string;
			name: string;
			calories: number;
			date: string;
		};
		error?: string;
	};

	let { output }: { output: DeleteMealOutput } = $props();
</script>

{#if output.error}
	<div class="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
		{output.error}
	</div>
{:else if output.success && output.deleted}
	<div class="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
		<Trash2Icon class="size-4 text-muted-foreground" />
		<span class="text-muted-foreground">Removed</span>
		<span class="font-medium">{output.deleted.name}</span>
		<span
			class="flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted-foreground"
		>
			<FlameIcon class="size-3" />
			{output.deleted.calories}
		</span>
	</div>
{/if}
