<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { signIn } from '$lib/auth';
	import { Button } from '$lib/components/ui/button/index.js';
	import HamburgerIcon from '@lucide/svelte/icons/hamburger';
	import { toast } from 'svelte-sonner';

	let isLoading = $state(false);

	const redirectTo = $derived(page.url.searchParams.get('redirect'));

	async function handleGoogleSignIn() {
		isLoading = true;
		try {
			await signIn.social({ provider: 'google', callbackURL: redirectTo || '/' });
		} catch {
			toast.error('Unable to sign in, please try again.');
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in to Calories</title>
	<meta name="description" content="Sign in to your Calories account to continue" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col items-center px-6 pt-20 sm:pt-32">
		<div class="flex flex-col items-center gap-8 w-full">
			<a href={resolve('/')} class="flex flex-col items-center gap-4">
				<div
					class="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-3xl shadow-sm"
				>
					<HamburgerIcon class="size-8" />
				</div>
				<div class="text-center space-y-1">
					<h1 class="text-2xl font-bold tracking-tight">Calories</h1>
					<p class="text-sm text-muted-foreground">Track your nutrition simply</p>
				</div>
			</a>

			<div
				class="w-full flex flex-col gap-4 rounded-3xl bg-card/50 p-6 sm:p-8 border border-border/50 shadow-sm"
			>
				<div class="text-center space-y-1 mb-2">
					<h2 class="font-bold text-lg">Welcome back</h2>
					<p class="text-xs text-muted-foreground">Sign in to your account to continue</p>
				</div>

				<Button
					variant="outline"
					class="w-full h-12 rounded-xl font-bold gap-3 bg-background hover:bg-muted/50 border-border/50 transition-all"
					type="button"
					disabled={isLoading}
					onclick={handleGoogleSignIn}
				>
					{#if isLoading}
						<div
							class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
						></div>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5">
							<path
								d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
								fill="currentColor"
							/>
						</svg>
					{/if}
					Continue with Google
				</Button>
			</div>

			<p class="text-center text-[10px] text-muted-foreground/50 px-8">
				By continuing, you agree to our Terms of Service and Privacy Policy.
			</p>
		</div>
	</div>
</div>
