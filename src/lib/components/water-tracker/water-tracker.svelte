<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getProfile } from '$lib/remote/profile.remote';
	import { getWaterForDate, updateWater } from '$lib/remote/water.remote';
	import DropletIcon from '@lucide/svelte/icons/droplet';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	let { date }: { date: string } = $props();

	const initialDate = untrack(() => date);
	const [initialProfile, initialWaterData] = await Promise.all([
		getProfile(),
		getWaterForDate(initialDate)
	]);
	const profile = $derived(getProfile().current ?? initialProfile);
	const waterData = $derived(
		getWaterForDate(date).current ?? (date === initialDate ? initialWaterData : null)
	);
	const useOz = $derived(profile?.units === 'imperial');
	const waterUnit = $derived(useOz ? 'oz' : 'ml');
	const waterSmallAmount = $derived(useOz ? 8 : 250);
	const waterLargeAmount = $derived(useOz ? 16 : 500);
	const waterGoal = $derived(profile?.waterGoal ?? (useOz ? 64 : 2000));
	const waterConsumed = $derived(waterData?.amount ?? 0);
	const waterPercent = $derived(Math.min((waterConsumed / waterGoal) * 100, 100));

	async function addWater(amount: number) {
		try {
			await updateWater({
				amount,
				date
			}).updates(getWaterForDate(date));
		} catch (err) {
			console.error('Failed to update water:', err);
			toast.error('Failed to update water');
		}
	}
</script>

<div class="flex shrink-0 items-center gap-3 rounded-xl bg-muted/30 p-3">
	<div class="relative size-12 shrink-0">
		<svg class="size-full -rotate-90" viewBox="0 0 40 40">
			<circle cx="20" cy="20" r="16" fill="none" class="stroke-muted" stroke-width="3" />
			<circle
				cx="20"
				cy="20"
				r="16"
				fill="none"
				class="stroke-blue-500 transition-all duration-300"
				stroke-width="3"
				stroke-linecap="round"
				stroke-dasharray={2 * Math.PI * 16}
				stroke-dashoffset={2 * Math.PI * 16 * (1 - waterPercent / 100)}
			/>
		</svg>
		<DropletIcon class="absolute inset-0 m-auto size-5 text-blue-500" />
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex items-baseline gap-1">
			<span class="text-lg font-bold tabular-nums">{waterConsumed}</span>
			<span class="text-xs text-muted-foreground">/ {waterGoal}{waterUnit}</span>
		</div>
		<span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
			Water intake
		</span>
	</div>
	<div class="flex gap-1">
		<Button
			size="sm"
			variant="ghost"
			class="size-8 rounded-lg px-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
			onclick={() => addWater(-waterSmallAmount)}
			disabled={waterConsumed === 0}
		>
			−
		</Button>
		<Button
			size="sm"
			variant="outline"
			class="h-8 rounded-lg px-2 text-xs font-semibold"
			onclick={() => addWater(waterSmallAmount)}
		>
			+{waterSmallAmount}
		</Button>
		<Button
			size="sm"
			variant="outline"
			class="h-8 rounded-lg px-2 text-xs font-semibold"
			onclick={() => addWater(waterLargeAmount)}
		>
			+{waterLargeAmount}
		</Button>
	</div>
</div>
