<script lang="ts">
	import { getProfile } from '$lib/remote/profile.remote';
	import { getLatestWeight } from '$lib/remote/weight.remote';
	import ActivityIcon from '@lucide/svelte/icons/activity';

	const [initialProfile, initialWeight] = await Promise.all([getProfile(), getLatestWeight()]);

	const profile = $derived(getProfile().current ?? initialProfile);
	const latestWeight = $derived(getLatestWeight().current ?? initialWeight);

	const height = $derived(profile?.height ?? null);
	const units = $derived(profile?.units ?? 'imperial');
	const weight = $derived(latestWeight?.weight ?? null);

	const bmi = $derived.by(() => {
		if (height === null || weight === null) return null;
		const heightM = height / 100;
		const weightKg = units === 'metric' ? weight : weight * 0.453592;
		return weightKg / (heightM * heightM);
	});

	type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obese';
	const category = $derived.by((): BmiCategory | null => {
		if (bmi === null) return null;
		if (bmi < 18.5) return 'underweight';
		if (bmi < 25) return 'healthy';
		if (bmi < 30) return 'overweight';
		return 'obese';
	});

	const categoryConfig: Record<BmiCategory, { label: string; color: string; bg: string }> = {
		underweight: { label: 'Underweight', color: 'text-sky-500', bg: 'bg-sky-500' },
		healthy: { label: 'Healthy', color: 'text-emerald-500', bg: 'bg-emerald-500' },
		overweight: { label: 'Overweight', color: 'text-amber-500', bg: 'bg-amber-500' },
		obese: { label: 'Obese', color: 'text-rose-500', bg: 'bg-rose-500' }
	};

	const config = $derived(category ? categoryConfig[category] : null);

	const scalePosition = $derived.by(() => {
		if (bmi === null) return 0;
		const clamped = Math.max(15, Math.min(35, bmi));
		return ((clamped - 15) / 20) * 100;
	});
</script>

<div class="flex flex-col gap-3 rounded-xl bg-muted/30 p-4">
	<div class="flex items-center gap-3">
		<div
			class="flex size-12 shrink-0 items-center justify-center rounded-xl {config
				? config.bg + '/10'
				: 'bg-muted/50'}"
		>
			<ActivityIcon class="size-6 {config ? config.color : 'text-muted-foreground'}" />
		</div>
		<div class="min-w-0 flex-1">
			{#if bmi !== null && config}
				<div class="flex items-baseline gap-1">
					<span class="text-2xl font-bold tabular-nums">{bmi.toFixed(1)}</span>
					<span class="text-sm text-muted-foreground">BMI</span>
				</div>
				<span class="{config.color} text-[10px] font-medium uppercase tracking-wider">
					{config.label}
				</span>
			{:else}
				<div class="text-sm text-muted-foreground">
					{#if height === null}
						Add your height in settings
					{:else}
						Log your weight to see BMI
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if bmi !== null}
		<div class="flex flex-col gap-1.5">
			<div class="relative h-2 w-full overflow-hidden rounded-full">
				<div class="absolute inset-0 flex">
					<div class="h-full flex-1 bg-sky-500/40"></div>
					<div class="h-full flex-1 bg-emerald-500/40"></div>
					<div class="h-full flex-1 bg-amber-500/40"></div>
					<div class="h-full flex-1 bg-rose-500/40"></div>
				</div>
				<div
					class="absolute top-0 h-full w-1 -translate-x-1/2 rounded-full bg-foreground shadow-sm"
					style="left: {scalePosition}%"
				></div>
			</div>
			<div class="flex justify-between text-[10px] text-muted-foreground">
				<span>18.5</span>
				<span>25</span>
				<span>30</span>
			</div>
		</div>
	{/if}
</div>
