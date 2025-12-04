<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import HamburgerIcon from '@lucide/svelte/icons/hamburger';
	import GoalIcon from '@lucide/svelte/icons/goal';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import type { User } from 'better-auth';
	import HeaderUserMenu from './header-user-menu.svelte';

	let {
		user,
		trialEnd,
		onGoalsClick,
		onAssistantClick
	}: {
		user?: User;
		trialEnd?: Date | string | null;
		onGoalsClick?: () => void;
		onAssistantClick?: () => void;
	} = $props();

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
					{trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left
				</Badge>
			{/if}
		</div>
		{#if user}
			<div class="flex items-center gap-1">
				{#if onAssistantClick}
					<Button variant="outline" size="icon" class="size-8" onclick={onAssistantClick}>
						<SparklesIcon class="size-4 text-muted-foreground" />
					</Button>
				{/if}
				{#if onGoalsClick}
					<Button variant="outline" size="icon" class="size-8" onclick={onGoalsClick}>
						<GoalIcon class="size-4 text-muted-foreground" />
					</Button>
				{/if}
				<HeaderUserMenu {user} />
			</div>
		{/if}
	</div>
</header>
