<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { createCheckoutSession } from '$lib/remote/checkout.remote';
	import CheckIcon from '@lucide/svelte/icons/check';
	import HamburgerIcon from '@lucide/svelte/icons/hamburger';
	import { toast } from 'svelte-sonner';

	let isLoading = $state(false);

	async function handleCheckout() {
		isLoading = true;
		try {
			const result = await createCheckoutSession();
			if (result.url) {
				window.location.href = result.url;
			}
		} catch {
			toast.error('Unable to start checkout, please try again.');
			isLoading = false;
		}
	}

	const features = [
		'Unlimited AI meal analysis',
		'Photo-based calorie tracking',
		'Personal AI nutrition assistant',
		'Weight tracking & goals',
		'Preference learning',
		'Lifetime access'
	];
</script>

<svelte:head>
	<title>Get Lifetime Access - Calories</title>
	<meta name="description" content="Get lifetime access to Calories for just $50" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col items-center px-6 pt-12 sm:pt-20">
		<div class="flex w-full flex-col items-center gap-8">
			<a href={resolve('/')} class="flex flex-col items-center gap-4">
				<div
					class="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-3xl shadow-sm"
				>
					<HamburgerIcon class="size-8" />
				</div>
				<div class="space-y-1 text-center">
					<h1 class="text-2xl font-bold tracking-tight">Calories</h1>
					<p class="text-sm text-muted-foreground">Track your nutrition simply</p>
				</div>
			</a>

			<div
				class="flex w-full flex-col gap-6 rounded-3xl border border-border/50 bg-card/50 p-6 shadow-sm sm:p-8"
			>
				<div class="mb-2 space-y-1 text-center">
					<h2 class="text-lg font-bold">Lifetime Access</h2>
					<div class="flex items-baseline justify-center gap-1">
						<span class="text-4xl font-bold">$50</span>
						<span class="text-muted-foreground">one-time</span>
					</div>
					<p class="text-xs text-muted-foreground">No subscriptions. Pay once, use forever.</p>
				</div>

				<div class="space-y-3">
					{#each features as feature (feature)}
						<div class="flex items-center gap-3">
							<div class="flex size-5 items-center justify-center rounded-full bg-primary/10">
								<CheckIcon class="size-3 text-primary" />
							</div>
							<span class="text-sm">{feature}</span>
						</div>
					{/each}
				</div>

				<Button
					class="h-12 w-full rounded-xl font-bold transition-all"
					type="button"
					disabled={isLoading}
					onclick={handleCheckout}
				>
					{#if isLoading}
						<div
							class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
						></div>
					{/if}
					Get Lifetime Access
				</Button>

				<p class="text-center text-[10px] text-muted-foreground/70">
					Secure payment via Stripe. 30-day money-back guarantee.
				</p>
			</div>

			<p class="text-center text-xs text-muted-foreground/60">
				Prefer to self-host?
				<a
					href="https://github.com/float32org/calories"
					target="_blank"
					rel="noopener noreferrer"
					class="underline hover:text-muted-foreground"
				>
					View on GitHub
				</a>
			</p>
		</div>
	</div>
</div>
