<script lang="ts">
	import { resolve } from '$app/paths';
	import HamburgerIcon from '@lucide/svelte/icons/hamburger';
	import type { User } from 'better-auth';
	import HeaderUserMenu from './header-user-menu.svelte';

	let { user }: { user: User } = $props();
</script>

<header
	class="bg-background/80 fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-4 px-4 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
>
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
	<div class="flex items-center gap-2">
		<HeaderUserMenu {user} />
	</div>
</header>
