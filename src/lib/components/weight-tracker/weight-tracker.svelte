<script lang="ts">
	import { WeightLogDialog } from '$lib/components/dialog';
	import { getProfile } from '$lib/remote/profile.remote';
	import { getLatestWeight, getWeightForDate, logWeight } from '$lib/remote/weight.remote';
	import { parseLocalDate } from '$lib/utils/format';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import { toast } from 'svelte-sonner';

	let { date }: { date: string } = $props();

	const dateObj = $derived(parseLocalDate(date));

	let isModalOpen = $state(false);

	const initialProfile = await getProfile();
	const initialLatestWeight = await getLatestWeight();

	const profile = $derived(getProfile().current ?? initialProfile);
	const latestWeight = $derived(getLatestWeight().current ?? initialLatestWeight);
	const weightForDate = $derived(getWeightForDate(date).current);

	const units = $derived(profile?.units ?? 'imperial');
	const weightUnit = $derived(units === 'metric' ? 'kg' : 'lbs');
	const weightGoal = $derived(profile?.weightGoal ?? null);
	const currentWeight = $derived(latestWeight?.weight ?? null);
	const weightAtGoal = $derived(
		weightGoal !== null && currentWeight !== null && currentWeight <= weightGoal
	);
	const weightToGo = $derived(
		weightGoal !== null && currentWeight !== null ? currentWeight - weightGoal : 0
	);

	async function handleLogWeight(weight: number) {
		try {
			await logWeight({ weight, date }).updates(getLatestWeight(), getWeightForDate(date));
		} catch (err) {
			console.error('Failed to log weight:', err);
			toast.error('Failed to log weight');
		}
	}
</script>

<button
	class="flex shrink-0 items-center gap-3 rounded-xl bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50"
	onclick={() => (isModalOpen = true)}
>
	<div class="relative size-12 shrink-0">
		<svg class="size-full -rotate-90" viewBox="0 0 40 40">
			<circle cx="20" cy="20" r="16" fill="none" class="stroke-muted" stroke-width="3" />
			{#if weightAtGoal}
				<circle
					cx="20"
					cy="20"
					r="16"
					fill="none"
					class="stroke-emerald-500 transition-all duration-300"
					stroke-width="3"
					stroke-linecap="round"
					stroke-dasharray={2 * Math.PI * 16}
					stroke-dashoffset={0}
				/>
			{/if}
		</svg>
		<ScaleIcon
			class="absolute inset-0 m-auto size-5 {weightAtGoal
				? 'text-emerald-500'
				: 'text-muted-foreground'}"
		/>
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex items-baseline gap-1">
			<span class="text-lg font-bold tabular-nums">
				{weightForDate?.weight ?? currentWeight ?? '—'}
			</span>
			<span class="text-xs text-muted-foreground">
				{#if weightGoal}/ {weightGoal} {weightUnit}{:else}{weightUnit}{/if}
			</span>
		</div>
		<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
			{#if weightForDate?.weight}
				Weight logged
			{:else if !currentWeight}
				Tap to log weight
			{:else if weightAtGoal}
				Goal reached!
			{:else}
				{weightToGo.toFixed(1)} {weightUnit} to go
			{/if}
		</span>
	</div>
</button>

<WeightLogDialog
	bind:open={isModalOpen}
	onSave={handleLogWeight}
	currentWeight={weightForDate?.weight ?? latestWeight?.weight ?? 0}
	unit={weightUnit}
	date={dateObj}
/>
