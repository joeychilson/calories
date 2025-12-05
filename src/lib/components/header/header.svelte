<script lang="ts">
	import { resolve } from '$app/paths';
	import { FoodAssistantDialog, GoalsDialog, InventoryDialog } from '$lib/components/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import ChefHatIcon from '@lucide/svelte/icons/chef-hat';
	import HamburgerIcon from '@lucide/svelte/icons/hamburger';
	import RefrigeratorIcon from '@lucide/svelte/icons/refrigerator';
	import type { User } from 'better-auth';
	import HeaderUserMenu from './header-user-menu.svelte';

	let {
		user,
		trialEnd,
		selectedDate
	}: {
		user?: User;
		trialEnd?: Date | string | null;
		selectedDate?: string;
	} = $props();

	let goalsOpen = $state(false);
	let assistantOpen = $state(false);
	let inventoryOpen = $state(false);

	const trialDaysLeft = $derived.by(() => {
		if (!trialEnd) return null;
		const end = new Date(trialEnd);
		const now = new Date();
		const diffMs = end.getTime() - now.getTime();
		const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : null;
	});
</script>

<header class="bg-background sticky top-0 z-50 w-full px-4 transition-all">
	<div class="flex h-14 w-full items-center justify-between gap-4">
		<div class="flex items-center gap-4">
			<a href={resolve('/')} class="flex items-center gap-2 font-medium">
				<div
					class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
				>
					<HamburgerIcon class="size-4" />
				</div>
				Calories
			</a>
			{#if trialDaysLeft}
				<Badge variant="secondary" class="text-xs">
					{trialDaysLeft}
					{trialDaysLeft === 1 ? 'day' : 'days'} left
				</Badge>
			{/if}
		</div>
		{#if user}
			<div class="flex items-center gap-1">
				{#if selectedDate}
					<Button
						variant="outline"
						size="icon"
						class="size-8"
						onclick={() => (assistantOpen = true)}
					>
						<ChefHatIcon class="size-4 text-muted-foreground" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						class="size-8"
						onclick={() => (inventoryOpen = true)}
					>
						<RefrigeratorIcon class="size-4 text-muted-foreground" />
					</Button>
					<Button variant="outline" size="icon" class="size-8" href={resolve('/progress')}>
						<ChartLineIcon class="size-4 text-muted-foreground" />
					</Button>
				{/if}
				<HeaderUserMenu {user} onGoalsClick={() => (goalsOpen = true)} />
			</div>
		{/if}
	</div>
</header>

{#if goalsOpen}
	<GoalsDialog bind:open={goalsOpen} />
{/if}
{#if assistantOpen && selectedDate}
	<FoodAssistantDialog bind:open={assistantOpen} date={selectedDate} />
{/if}
{#if inventoryOpen}
	<InventoryDialog bind:open={inventoryOpen} />
{/if}
