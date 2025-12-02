<script lang="ts">
	let {
		calories,
		protein,
		carbs,
		fat,
		label,
		servingsLabel,
		size = 'md',
		alwaysShowMacros = false
	}: {
		calories: number;
		protein: number;
		carbs: number;
		fat: number;
		label?: string;
		servingsLabel?: string;
		size?: 'md' | 'lg';
		alwaysShowMacros?: boolean;
	} = $props();

	const hasMacros = $derived(protein > 0 || carbs > 0 || fat > 0);
	const showMacros = $derived(alwaysShowMacros || hasMacros);
</script>

<div class="rounded-xl bg-muted/30 p-4">
	{#if label || servingsLabel}
		<div class="flex items-center justify-between mb-2">
			{#if label}
				<span class="text-sm font-medium text-muted-foreground">{label}</span>
			{/if}
			{#if servingsLabel}
				<span class="text-xs text-muted-foreground">{servingsLabel}</span>
			{/if}
		</div>
	{/if}
	<div class="flex items-baseline gap-1">
		<span class="{size === 'lg' ? 'text-3xl' : 'text-2xl'} font-bold tabular-nums">{calories}</span>
		<span class="text-sm font-medium text-muted-foreground">kcal</span>
	</div>
	{#if showMacros}
		<div class="mt-2 flex items-center gap-3 text-sm">
			{#if alwaysShowMacros || protein > 0}
				<span class="text-blue-500 dark:text-blue-400 font-medium">{protein}g P</span>
				{#if alwaysShowMacros}<span class="text-muted-foreground/40">•</span>{/if}
			{/if}
			{#if alwaysShowMacros || carbs > 0}
				<span class="text-amber-500 dark:text-amber-400 font-medium">{carbs}g C</span>
				{#if alwaysShowMacros}<span class="text-muted-foreground/40">•</span>{/if}
			{/if}
			{#if alwaysShowMacros || fat > 0}
				<span class="text-rose-500 dark:text-rose-400 font-medium">{fat}g F</span>
			{/if}
		</div>
	{/if}
</div>
