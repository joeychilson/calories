<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import HamburgerIcon from '@lucide/svelte/icons/hamburger';
	import GoalIcon from '@lucide/svelte/icons/goal';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import type { User } from 'better-auth';
	import HeaderUserMenu from './header-user-menu.svelte';

	let {
		user,
		onGoalsClick,
		onAssistantClick
	}: {
		user: User;
		onGoalsClick?: () => void;
		onAssistantClick?: () => void;
	} = $props();
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
		</div>
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
	</div>
</header>
