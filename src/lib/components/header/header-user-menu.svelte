<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { signOut } from '$lib/auth';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import UserIcon from '@lucide/svelte/icons/user';
	import SunIcon from '@lucide/svelte/icons/sun';
	import type { User } from 'better-auth';
	import { mode, setMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';

	let { user }: { user: User } = $props();
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<Avatar
				class="size-8 rounded-md"
				aria-label="User menu for {user?.name || 'User'}"
				{...props}
			>
				{#if user && user.image}
					<AvatarImage src={user.image} alt={user.name || 'User avatar'} />
				{/if}
				<AvatarFallback class="size-8 rounded-md">
					{user?.name?.[0] || '?'}
				</AvatarFallback>
			</Avatar>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end" preventScroll={false}>
		<DropdownMenuItem onclick={() => goto(resolve('/account'))}>
			<UserIcon class="size-4" />
			<span>Account</span>
		</DropdownMenuItem>
		<DropdownMenuItem
			onclick={() => {
				if (mode.current === 'light') {
					setMode('dark');
				} else {
					setMode('light');
				}
			}}
		>
			{#if mode.current === 'light'}
				<MoonIcon class="size-4" />
				<span>Dark Mode</span>
			{:else}
				<SunIcon class="size-4" />
				<span>Light Mode</span>
			{/if}
		</DropdownMenuItem>
		<DropdownMenuItem
			onclick={async () => {
				await signOut();
				goto(resolve('/signin'), { invalidateAll: true });
				toast.success('Goodbye! Hope to see you back soon!');
			}}
		>
			<LogOutIcon class="size-4" />
			<span>Sign out</span>
		</DropdownMenuItem>
	</DropdownMenuContent>
</DropdownMenu>
