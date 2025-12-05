<script lang="ts">
	import { StreakCard } from '$lib/components/streak-card';
	import { Button } from '$lib/components/ui/button';
	import { WeightChart } from '$lib/components/weight-chart';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
</script>

<svelte:head>
	<title>Progress - Calories</title>
	<meta name="description" content="Track your nutrition progress and trends" />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
		<header class="flex shrink-0 items-center gap-4 px-4 py-2">
			<Button
				variant="ghost"
				size="icon"
				class="rounded-full"
				onclick={() => window.history.back()}
			>
				<ChevronLeftIcon class="size-5 text-muted-foreground" />
			</Button>
			<h1 class="text-lg font-bold">Progress</h1>
		</header>

		<div class="flex-1 overflow-y-auto px-6 pb-20 no-scrollbar">
			<div class="flex flex-col gap-4 py-4">
				<StreakCard />
				<WeightChart />
			</div>
		</div>
	</div>
</div>
