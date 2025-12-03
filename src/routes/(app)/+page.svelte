<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { CalorieSummary } from '$lib/components/calorie-summary';
	import { DayNavigation } from '$lib/components/day-navigation';
	import { FoodAssistantDialog, SettingsDialog } from '$lib/components/dialog';
	import { MealsList } from '$lib/components/meals-list';
	import { WaterTracker } from '$lib/components/water-tracker';
	import { WeightTracker } from '$lib/components/weight-tracker';
	import { addMeal, getMeals } from '$lib/remote/meals.remote';
	import { getProfile } from '$lib/remote/profile.remote';
	import { getWaterForDate } from '$lib/remote/water.remote';
	import { getLatestWeight } from '$lib/remote/weight.remote';
	import { assistantOpen, settingsOpen } from '$lib/stores/ui.store';
	import { formatDate } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import { SvelteDate } from 'svelte/reactivity';

	function parseDateParam(param: string | null): Date {
		if (!param) return new Date();
		const parsed = new Date(param + 'T00:00:00');
		return isNaN(parsed.getTime()) ? new Date() : parsed;
	}

	const initialDateParam = page.url.searchParams.get('d');
	const selectedDate = new SvelteDate(parseDateParam(initialDateParam));

	function updateUrlDate(date: Date) {
		const todayStr = formatDate(new Date());
		const dateStr = formatDate(date);

		if (dateStr === todayStr) {
			goto(resolve('/'), { replaceState: true, keepFocus: true, noScroll: true });
		} else {
			goto(`/?d=${dateStr}`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	}
	const initialMeals = await getMeals();
	const initialProfile = await getProfile();
	const initialLatestWeight = await getLatestWeight();

	const meals = $derived(getMeals().current ?? initialMeals);
	const profile = $derived(getProfile().current ?? initialProfile);
	const latestWeight = $derived(getLatestWeight().current ?? initialLatestWeight);

	const selectedDateStr = $derived(formatDate(selectedDate));

	let currentDayMeals = $derived.by(() => {
		const dateStr = formatDate(selectedDate);
		return meals.filter((m) => m.date === dateStr).sort((a, b) => b.timestamp - a.timestamp);
	});

	let calorieGoal = $derived(profile?.calorieGoal ?? 2000);
	let units = $derived(profile?.units ?? 'imperial');
	let currentWeight = $derived(latestWeight?.weight ?? null);

	let totalCalories = $derived(currentDayMeals.reduce((acc, m) => acc + m.calories, 0));
	let totalProtein = $derived(currentDayMeals.reduce((acc, m) => acc + (m.protein || 0), 0));
	let totalCarbs = $derived(currentDayMeals.reduce((acc, m) => acc + (m.carbs || 0), 0));
	let totalFat = $derived(currentDayMeals.reduce((acc, m) => acc + (m.fat || 0), 0));
	let waterGoal = $derived(profile?.waterGoal ?? (units === 'imperial' ? 64 : 2000));
	const waterForSelectedDate = $derived(getWaterForDate(selectedDateStr).current);
	let waterConsumed = $derived(waterForSelectedDate?.amount ?? 0);

	let assistantContext = $derived({
		calorieGoal,
		caloriesConsumed: totalCalories,
		proteinConsumed: totalProtein,
		carbsConsumed: totalCarbs,
		fatConsumed: totalFat,
		waterGoal,
		waterConsumed,
		currentWeight,
		weightGoal: profile?.weightGoal ?? null,
		units,
		sex: profile?.sex ?? null,
		activityLevel: profile?.activityLevel ?? 'moderate'
	});

	type MealInput = {
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
		imageKey?: string;
	};

	async function handleAddMeal(meal: MealInput) {
		const mealTime = new Date(
			selectedDate.getFullYear(),
			selectedDate.getMonth(),
			selectedDate.getDate(),
			new Date().getHours(),
			new Date().getMinutes(),
			new Date().getSeconds()
		).toISOString();

		try {
			await addMeal({
				name: meal.name,
				calories: meal.calories,
				servings: meal.servings ?? 1,
				protein: meal.protein,
				carbs: meal.carbs,
				fat: meal.fat,
				imageKey: meal.imageKey,
				mealDate: formatDate(selectedDate),
				mealTime
			}).updates(getMeals());
		} catch (err) {
			console.error('Failed to add meal:', err);
			toast.error('Failed to log meal');
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

		<div class="flex min-h-0 flex-1 flex-col px-6">
			<div class="flex min-h-0 flex-1 flex-col gap-4">
				<CalorieSummary date={selectedDateStr} />

				<!-- Weight Tracker -->
				<WeightTracker date={selectedDateStr} />

				<!-- Water Tracker -->
				<WaterTracker date={selectedDateStr} />

				<MealsList date={selectedDateStr} />
			</div>
		</div>
	</div>

	<SettingsDialog
		bind:open={$settingsOpen}
		currentCalorieGoal={calorieGoal}
		currentWaterGoal={waterGoal}
		currentWeightGoal={profile?.weightGoal ?? null}
		{currentWeight}
		{units}
		onSave={() => getProfile().refresh()}
	/>
	<FoodAssistantDialog
		bind:open={$assistantOpen}
		context={assistantContext}
		onLogMeal={handleAddMeal}
	/>
</div>
