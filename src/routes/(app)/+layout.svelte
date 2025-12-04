<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	import { page } from '$app/state';
	import { FoodAssistantDialog, GoalsDialog } from '$lib/components/dialog';
	import { Header } from '$lib/components/header';
	import { assistantOpen, goalsOpen } from '$lib/stores/ui.store';
	import { formatDate } from '$lib/utils/format';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const selectedDate = $derived.by(() => {
		const dateParam = page.url.searchParams.get('d');
		if (!dateParam) return formatDate(new Date());
		const parsed = new Date(dateParam + 'T00:00:00');
		return isNaN(parsed.getTime()) ? formatDate(new Date()) : dateParam;
	});
</script>

<div class="flex h-dvh flex-col">
	{#if data.user}
		<Header
			user={data.user}
			trialEnd={data.trialEnd}
			onGoalsClick={() => goalsOpen.set(true)}
			onAssistantClick={() => assistantOpen.set(true)}
		/>
	{/if}
	<main class="min-h-0 flex-1">
		{@render children()}
	</main>
</div>

<GoalsDialog bind:open={$goalsOpen} />
<FoodAssistantDialog bind:open={$assistantOpen} date={selectedDate} />
