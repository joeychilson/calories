<script lang="ts">
	import { getMeals } from '$lib/remote/meals.remote';
	import { getProfile } from '$lib/remote/profile.remote';
	import CalorieSummaryChart from './calorie-summary-chart.svelte';

	let { date }: { date: string } = $props();

	const PROTEIN_PERCENT = 0.3;
	const CARBS_PERCENT = 0.35;
	const FAT_PERCENT = 0.35;
	const CALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

	const [initialMeals, initialProfile] = await Promise.all([getMeals(), getProfile()]);

	const meals = $derived(getMeals().current ?? initialMeals);
	const profile = $derived(getProfile().current ?? initialProfile);
	const calorieGoal = $derived(profile?.calorieGoal ?? 2000);
	const proteinGoal = $derived(
		Math.round((calorieGoal * PROTEIN_PERCENT) / CALORIES_PER_GRAM.protein)
	);
	const carbsGoal = $derived(Math.round((calorieGoal * CARBS_PERCENT) / CALORIES_PER_GRAM.carbs));
	const fatGoal = $derived(Math.round((calorieGoal * FAT_PERCENT) / CALORIES_PER_GRAM.fat));
	const currentDayMeals = $derived.by(() => {
		return meals.filter((m) => m.date === date).sort((a, b) => b.timestamp - a.timestamp);
	});
	const chartMeals = $derived(
		currentDayMeals.map((m) => ({
			id: m.id,
			name: m.name,
			calories: m.calories
		}))
	);
	const totalProtein = $derived(currentDayMeals.reduce((acc, m) => acc + (m.protein || 0), 0));
	const totalCarbs = $derived(currentDayMeals.reduce((acc, m) => acc + (m.carbs || 0), 0));
	const totalFat = $derived(currentDayMeals.reduce((acc, m) => acc + (m.fat || 0), 0));
	const proteinProgress = $derived(Math.min((totalProtein / proteinGoal) * 100, 100));
	const carbsProgress = $derived(Math.min((totalCarbs / carbsGoal) * 100, 100));
	const fatProgress = $derived(Math.min((totalFat / fatGoal) * 100, 100));
</script>

<div class="shrink-0">
	<div class="flex flex-col items-center justify-center py-2">
		<CalorieSummaryChart meals={chartMeals} goal={calorieGoal} size={200} thickness={16} />

		<div class="mt-2 flex items-center gap-6">
			<div class="flex flex-col items-center gap-1">
				<span class="text-sm font-bold text-blue-500 dark:text-blue-400">
					{totalProtein}<span class="text-muted-foreground/60 font-medium">/{proteinGoal}g</span>
				</span>
				<div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
					<div
						class="h-full rounded-full bg-blue-500 transition-all duration-500 dark:bg-blue-400"
						style="width: {proteinProgress}%"
					></div>
				</div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
					Protein
				</span>
			</div>
			<div class="flex flex-col items-center gap-1">
				<span class="text-sm font-bold text-amber-500 dark:text-amber-400">
					{totalCarbs}<span class="text-muted-foreground/60 font-medium">/{carbsGoal}g</span>
				</span>
				<div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
					<div
						class="h-full rounded-full bg-amber-500 transition-all duration-500 dark:bg-amber-400"
						style="width: {carbsProgress}%"
					></div>
				</div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
					Carbs
				</span>
			</div>
			<div class="flex flex-col items-center gap-1">
				<span class="text-sm font-bold text-rose-500 dark:text-rose-400">
					{totalFat}<span class="text-muted-foreground/60 font-medium">/{fatGoal}g</span>
				</span>
				<div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
					<div
						class="h-full rounded-full bg-rose-500 transition-all duration-500 dark:bg-rose-400"
						style="width: {fatProgress}%"
					></div>
				</div>
				<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
					Fat
				</span>
			</div>
		</div>
	</div>
</div>
