<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { CalorieSummary } from '$lib/components/calorie-summary';
	import { DayNavigation } from '$lib/components/day-navigation';
	import { MealsList } from '$lib/components/meals-list';
	import { WaterTracker } from '$lib/components/water-tracker';
	import { WeightTracker } from '$lib/components/weight-tracker';
	import { formatDate } from '$lib/utils/format';
	import { SvelteDate } from 'svelte/reactivity';

	const initialDateParam = page.url.searchParams.get('d');
	const selectedDate = new SvelteDate(parseDateParam(initialDateParam));
	const selectedDateStr = $derived(formatDate(selectedDate));

	function parseDateParam(param: string | null): Date {
		if (!param) return new Date();
		const parsed = new Date(param + 'T00:00:00');
		return isNaN(parsed.getTime()) ? new Date() : parsed;
	}

	function updateUrlDate(date: Date) {
		const todayStr = formatDate(new Date());
		const dateStr = formatDate(date);

		if (dateStr === todayStr) {
			goto(resolve('/'), { replaceState: true, keepFocus: true, noScroll: true });
		} else {
			goto(`/?d=${dateStr}`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	}
</script>

<svelte:head>
	<title>Calories</title>
	<meta
		name="description"
		content="Calories is a simple app to help you track your calories and progress."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex h-full flex-col bg-background">
	<div class="mx-auto flex h-full w-full max-w-md flex-col">
		<DayNavigation date={selectedDate} onDateChange={() => updateUrlDate(selectedDate)} />
		<div class="flex min-h-0 flex-1 flex-col px-4">
			<div class="flex min-h-0 flex-1 flex-col gap-3">
				<CalorieSummary date={selectedDateStr} />
				<WeightTracker date={selectedDateStr} />
				<WaterTracker date={selectedDateStr} />
				<MealsList date={selectedDateStr} />
			</div>
		</div>
	</div>
</div>
