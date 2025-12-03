<script lang="ts">
	import { DatePickerDialog } from '$lib/components/dialog';
	import { Button } from '$lib/components/ui/button';
	import { getMeals } from '$lib/remote/meals.remote';
	import { getProfile } from '$lib/remote/profile.remote';
	import { formatDate, getDisplayDate } from '$lib/utils/format';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { SvelteDate } from 'svelte/reactivity';
	import { SvelteMap } from 'svelte/reactivity';

	let {
		date,
		onDateChange
	}: {
		date: SvelteDate;
		onDateChange?: () => void;
	} = $props();

	let isDatePickerOpen = $state(false);
	let wasDatePickerOpen = $state(false);

	$effect(() => {
		if (wasDatePickerOpen && !isDatePickerOpen) {
			onDateChange?.();
		}
		wasDatePickerOpen = isDatePickerOpen;
	});

	const initialMeals = await getMeals();
	const initialProfile = await getProfile();

	const meals = $derived(getMeals().current ?? initialMeals);
	const profile = $derived(getProfile().current ?? initialProfile);
	const calorieGoal = $derived(profile?.calorieGoal ?? 2000);

	const history = $derived.by(() => {
		const historyMap = new SvelteMap<string, number>();
		for (const m of meals) {
			historyMap.set(m.date, (historyMap.get(m.date) || 0) + m.calories);
		}

		return Array.from(historyMap.entries()).map(([d, cals]) => ({
			date: d,
			status:
				cals > calorieGoal
					? 'over'
					: ((cals > calorieGoal * 0.8 ? 'met' : 'under') as 'over' | 'met' | 'under')
		}));
	});

	const isToday = $derived(formatDate(date) === formatDate(new Date()));

	function handleDateChange(days: number) {
		date.setDate(date.getDate() + days);
		onDateChange?.();
	}
</script>

<header class="flex shrink-0 items-center justify-between px-4 py-2">
	<Button variant="ghost" size="icon" class="rounded-full" onclick={() => handleDateChange(-1)}>
		<ChevronLeftIcon class="size-5 text-muted-foreground" />
	</Button>
	<button class="flex flex-col items-center" onclick={() => (isDatePickerOpen = true)}>
		<span class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
			{date.getFullYear()}
		</span>
		<span class="text-lg font-bold text-foreground">
			{getDisplayDate(date)}
		</span>
	</button>
	<Button
		variant="ghost"
		size="icon"
		class="rounded-full"
		onclick={() => handleDateChange(1)}
		disabled={isToday}
	>
		<ChevronRightIcon class="size-5 text-muted-foreground" />
	</Button>
</header>

<DatePickerDialog bind:open={isDatePickerOpen} {date} {history} />
