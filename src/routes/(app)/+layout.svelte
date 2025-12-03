<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	import OnboardingDialog from '$lib/components/dialog/dialog-onboarding.svelte';
	import { Header } from '$lib/components/header';
	import { getProfile } from '$lib/remote/profile.remote';
	import { getSubscription } from '$lib/remote/subscriptions.remote';
	import { getLatestWeight } from '$lib/remote/weight.remote';
	import { assistantOpen, settingsOpen } from '$lib/stores/ui.store';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const initialSubscription = await getSubscription();

	let isOnboardingOpen = $state(!initialSubscription.onboardingCompleted);
</script>

<div class="flex h-dvh flex-col">
	<Header
		user={data.user}
		onSettingsClick={() => settingsOpen.set(true)}
		onAssistantClick={() => assistantOpen.set(true)}
	/>
	<main class="min-h-0 flex-1">
		{@render children()}
	</main>
</div>

<OnboardingDialog
	bind:open={isOnboardingOpen}
	onComplete={() => {
		getProfile().refresh();
		getSubscription().refresh();
		getLatestWeight().refresh();
	}}
/>
