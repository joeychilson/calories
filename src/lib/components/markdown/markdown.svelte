<script lang="ts">
	import { cn } from '$lib/utils/ui';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';

	let { source, class: className }: { source: string; class?: string } = $props();
</script>

<div
	class={cn('prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0', className)}
>
	<SvelteMarkdown {source} />
</div>
