<script lang="ts">
	import { client, subscription } from '$lib/auth';
	import { AccountDeleteDialog } from '$lib/components/dialog';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { getSubscription } from '$lib/remote/subscriptions.remote';
	import { getSessions } from '$lib/remote/users.remote';
	import { getDeviceInfo } from '$lib/utils/device';
	import { formatTimeAgo } from '$lib/utils/format';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import UserIcon from '@lucide/svelte/icons/user';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const subscriptionData = await getSubscription();

	let sessions = await getSessions();
	let deleteAccountOpen = $state(false);
	let isRevokingSession = $state<string | null>(null);
	let isLoadingPortal = $state(false);

	const sortedSessions = $derived(
		[...(sessions ?? [])].sort((a, b) => {
			if (a.id === data.session?.id) return -1;
			if (b.id === data.session?.id) return 1;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		})
	);

	async function openBillingPortal() {
		isLoadingPortal = true;
		try {
			const result = await subscription.billingPortal({
				returnUrl: window.location.href
			});
			if (result.data?.url) {
				window.location.href = result.data.url;
			} else if (result.error) {
				toast.error(result.error.message || 'Unable to open billing portal');
			}
		} catch {
			toast.error('Unable to open billing portal');
		} finally {
			isLoadingPortal = false;
		}
	}

	async function revokeSession(sessionId: string, sessionToken: string) {
		isRevokingSession = sessionId;
		try {
			await client.revokeSession({ token: sessionToken });
			sessions = sessions?.filter((s) => s.id !== sessionId) ?? [];
			await getSessions().refresh();
		} catch {
			toast.error('Unable to revoke session');
		} finally {
			isRevokingSession = null;
		}
	}
</script>

<svelte:head>
	<title>Account - Calories</title>
	<meta name="description" content="Manage your account and security settings" />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
		<header class="flex shrink-0 items-center gap-4 px-4 py-2">
			<Button variant="ghost" size="icon" onclick={() => window.history.back()}>
				<ArrowLeftIcon class="size-4 text-muted-foreground" />
			</Button>
			<h1 class="text-lg font-bold">Account</h1>
		</header>

		<div class="flex-1 overflow-y-auto px-6 pb-20 no-scrollbar">
			<div class="flex flex-col gap-6 py-4">
				<div class="flex flex-col gap-3">
					<h2
						class="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider"
					>
						<UserIcon class="size-4" />
						Account
					</h2>
					<div class="flex flex-col gap-3 rounded-3xl bg-card/50 p-5 transition-all">
						<div class="flex items-center gap-4">
							<div class="relative shrink-0">
								<Avatar class="size-16 rounded-2xl border-2 border-background shadow-sm">
									<AvatarImage
										src={data.user?.image ?? undefined}
										alt={data.user?.name ?? 'User avatar'}
									/>
									<AvatarFallback class="rounded-2xl text-lg"
										>{data.user?.name?.[0] ?? 'U'}</AvatarFallback
									>
								</Avatar>
							</div>
							<div class="flex flex-col gap-1 min-w-0">
								<h3 class="font-bold text-lg leading-tight truncate">
									{data.user?.name ?? 'Not set'}
								</h3>
								<p class="text-sm text-muted-foreground truncate">{data.user?.email}</p>
								<div class="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground/80">
									<CalendarIcon class="size-3" />
									<span
										>Joined {data.user?.createdAt ? formatTimeAgo(data.user.createdAt) : '-'}</span
									>
								</div>
							</div>
						</div>
					</div>
				</div>
				{#if subscriptionData.required}
					<div class="flex flex-col gap-3">
						<h2
							class="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider"
						>
							<CreditCardIcon class="size-4" />
							Subscription
						</h2>
						<div class="flex flex-col gap-3 rounded-3xl bg-card/50 p-5 transition-all">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="font-bold">Calories Pro</h3>
									<p class="text-sm text-muted-foreground">
										{#if subscriptionData.subscriptionStatus === 'trialing'}
											Trial ends {subscriptionData.trialEnd
												? new Date(subscriptionData.trialEnd).toLocaleDateString()
												: 'soon'}
										{:else if subscriptionData.cancelAtPeriodEnd}
											Cancels {subscriptionData.periodEnd
												? new Date(subscriptionData.periodEnd).toLocaleDateString()
												: 'at period end'}
										{:else}
											$3/month
										{/if}
									</p>
								</div>
								<Badge
									variant={subscriptionData.subscriptionStatus === 'active'
										? 'default'
										: 'secondary'}
								>
									{subscriptionData.subscriptionStatus === 'trialing'
										? 'Trial'
										: subscriptionData.subscriptionStatus === 'active'
											? 'Active'
											: (subscriptionData.subscriptionStatus ?? 'Inactive')}
								</Badge>
							</div>
							<Button
								variant="outline"
								class="w-full rounded-xl"
								onclick={openBillingPortal}
								disabled={isLoadingPortal}
							>
								{#if isLoadingPortal}
									<div
										class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2"
									></div>
								{/if}
								Manage Subscription
							</Button>
						</div>
					</div>
				{/if}
				<div class="flex flex-col gap-3">
					<h2
						class="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider"
					>
						<ShieldIcon class="size-4" />
						Sessions
					</h2>
					<div class="flex flex-col gap-3">
						{#if sortedSessions.length}
							{#each sortedSessions as session (session.id)}
								{@const device = getDeviceInfo(session.userAgent ?? null)}
								<div
									class="group relative flex items-center justify-between gap-4 rounded-3xl bg-card/50 p-4 transition-all hover:bg-muted/50"
								>
									<div class="flex items-center gap-4 min-w-0">
										<div
											class="bg-muted/60 flex size-12 shrink-0 items-center justify-center rounded-2xl"
										>
											<device.icon class="text-foreground/70 size-6" />
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<h4 class="font-bold text-sm truncate">{device.name}</h4>
												{#if session.id === data.session?.id}
													<Badge variant="secondary" class="h-5 px-1.5 text-[10px] font-medium">
														Current
													</Badge>
												{/if}
											</div>
											<div class="text-xs text-muted-foreground mt-0.5">
												Active {formatTimeAgo(session.createdAt)}
											</div>
										</div>
									</div>

									{#if session.id !== data.session?.id}
										<Button
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-destructive shrink-0 rounded-full h-8 w-8"
											onclick={() => revokeSession(session.id, session.token)}
											disabled={isRevokingSession === session.id}
										>
											{#if isRevokingSession === session.id}
												<div
													class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
												></div>
											{:else}
												<XCircleIcon class="size-5" />
											{/if}
										</Button>
									{/if}
								</div>
							{/each}
						{:else}
							<div class="rounded-3xl bg-card/50 p-8 text-center">
								<div
									class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"
								>
									<ShieldIcon class="size-6 opacity-50" />
								</div>
								<p class="text-sm text-muted-foreground">No active sessions found</p>
							</div>
						{/if}
					</div>
				</div>
				<div class="flex flex-col gap-3">
					<h2
						class="flex items-center gap-2 text-sm font-bold text-destructive uppercase tracking-wider"
					>
						<AlertTriangleIcon class="size-4" />
						Danger Zone
					</h2>
					<div class="rounded-3xl bg-destructive/5 border border-destructive/10 p-5">
						<h3 class="font-bold text-foreground mb-1">Delete Account</h3>
						<p class="text-xs text-muted-foreground mb-4">
							Permanently remove your account and all associated data. This action cannot be undone.
							Your subscription will be canceled immediately.
						</p>
						<Button
							variant="destructive"
							class="w-full rounded-xl font-bold"
							onclick={() => (deleteAccountOpen = true)}
						>
							<TrashIcon class="mr-2 size-4" />
							Delete Account
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<AccountDeleteDialog bind:open={deleteAccountOpen} />
</div>
