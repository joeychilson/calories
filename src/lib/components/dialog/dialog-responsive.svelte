<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '$lib/components/ui/drawer';
	import { cn } from '$lib/utils/ui';
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	const isDesktop = new MediaQuery('(min-width: 768px)');

	let {
		open = $bindable(false),
		title,
		subtitle,
		icon,
		children,
		contentClass = 'sm:max-w-lg',
		iconContainerClass = 'bg-muted rounded-lg p-2',
		titleClass,
		headerClass
	}: {
		open: boolean;
		title: string;
		subtitle?: string;
		icon?: Snippet;
		children: Snippet;
		contentClass?: string;
		iconContainerClass?: string;
		titleClass?: string;
		headerClass?: string;
	} = $props();
</script>

{#if isDesktop.current}
	<Dialog bind:open>
		<DialogContent class={contentClass}>
			<DialogHeader class={cn('space-y-1', headerClass)}>
				<div class="flex items-center gap-3">
					{#if icon}
						<div class={iconContainerClass}>
							{@render icon()}
						</div>
					{/if}
					<div>
						<DialogTitle class={cn('text-lg font-semibold leading-none tracking-tight', titleClass)}
							>{title}</DialogTitle
						>
						{#if subtitle}
							<p class="text-muted-foreground text-sm">{subtitle}</p>
						{/if}
					</div>
				</div>
			</DialogHeader>

			{@render children()}
		</DialogContent>
	</Dialog>
{:else}
	<Drawer bind:open>
		<DrawerContent class="max-h-[90vh]">
			<DrawerHeader class={cn('text-left', headerClass)}>
				<div class="flex items-center gap-3">
					{#if icon}
						<div class={iconContainerClass}>
							{@render icon()}
						</div>
					{/if}
					<div>
						<DrawerTitle class={cn('text-lg font-semibold leading-none tracking-tight', titleClass)}
							>{title}</DrawerTitle
						>
						{#if subtitle}
							<p class="text-muted-foreground text-sm">{subtitle}</p>
						{/if}
					</div>
				</div>
			</DrawerHeader>

			<div class={cn('flex-1 overflow-y-auto px-4 pb-6 mx-auto w-full', contentClass)}>
				{@render children()}
			</div>
		</DrawerContent>
	</Drawer>
{/if}
