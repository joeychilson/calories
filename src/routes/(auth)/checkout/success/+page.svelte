<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { getSubscription } from '$lib/remote/subscriptions.remote';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import HamburgerIcon from '@lucide/svelte/icons/hamburger';
	import { onMount } from 'svelte';

	let status = $state<'loading' | 'success' | 'pending'>('loading');

	async function checkPaymentStatus() {
		for (let i = 0; i < 10; i++) {
			const result = await getSubscription();
			if (result.paid) {
				status = 'success';
				return;
			}
			await new Promise((r) => setTimeout(r, 1000));
		}
		status = 'pending';
	}

	function handleContinue() {
		goto(resolve('/'));
	}

	onMount(() => {
		checkPaymentStatus();
	});
</script>

<svelte:head>
	<title>Payment Successful - Calories</title>
	<meta name="description" content="Your payment was successful" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col items-center px-6 pt-20 sm:pt-32">
		<div class="flex w-full flex-col items-center gap-8">
			<a href={resolve('/')} class="flex flex-col items-center gap-4">
				<div
					class="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-3xl shadow-sm"
				>
					<HamburgerIcon class="size-8" />
				</div>
			</a>
			<div
				class="flex w-full flex-col gap-6 rounded-3xl border border-border/50 bg-card/50 p-6 shadow-sm sm:p-8"
			>
				{#if status === 'loading'}
					<div class="flex flex-col items-center gap-4 py-4">
						<div
							class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
						></div>
						<p class="text-sm text-muted-foreground">Confirming your payment...</p>
					</div>
				{:else if status === 'success'}
					<div class="flex flex-col items-center gap-4">
						<div class="flex size-16 items-center justify-center rounded-full bg-green-500/10">
							<CheckCircleIcon class="size-8 text-green-500" />
						</div>
						<div class="space-y-1 text-center">
							<h2 class="text-lg font-bold">Payment Successful!</h2>
							<p class="text-sm text-muted-foreground">
								Thank you for your purchase. You now have lifetime access to Calories.
							</p>
						</div>
					</div>
					<Button
						class="h-12 w-full rounded-xl font-bold transition-all"
						type="button"
						onclick={handleContinue}
					>
						Get Started
					</Button>
				{:else}
					<div class="flex flex-col items-center gap-4">
						<div class="space-y-1 text-center">
							<h2 class="text-lg font-bold">Processing Payment</h2>
							<p class="text-sm text-muted-foreground">
								Your payment is being processed. This may take a moment. Please refresh or try again
								in a few seconds.
							</p>
						</div>
					</div>
					<Button
						class="h-12 w-full rounded-xl font-bold transition-all"
						type="button"
						onclick={checkPaymentStatus}
					>
						Check Again
					</Button>
				{/if}
			</div>
		</div>
	</div>
</div>
