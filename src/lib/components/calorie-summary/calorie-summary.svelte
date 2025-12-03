<script lang="ts">
	import { getMeals } from '$lib/remote/meals.remote';
	import { getProfile } from '$lib/remote/profile.remote';
	import CalorieSummaryChart from './calorie-summary-chart.svelte';

	let { date }: { date: string } = $props();

	const [initialMeals, initialProfile] = await Promise.all([getMeals(), getProfile()]);
	const meals = $derived(getMeals().current ?? initialMeals);
	const profile = $derived(getProfile().current ?? initialProfile);
	const calorieGoal = $derived(profile?.calorieGoal ?? 2000);
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
</script>

<div class="shrink-0">
	<div class="flex flex-col items-center justify-center py-2">
		<CalorieSummaryChart meals={chartMeals} goal={calorieGoal} size={200} thickness={16} />

		<div class="mt-2 flex items-center gap-8">
			<div class="flex flex-col items-center">
				<span class="text-lg font-bold text-blue-500 dark:text-blue-400">{totalProtein}g</span>
				<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
					Protein
				</span>
			</div>
			<div class="h-8 w-px bg-border/50"></div>
			<div class="flex flex-col items-center">
				<span class="text-lg font-bold text-amber-500 dark:text-amber-400">{totalCarbs}g</span>
				<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
					Carbs
				</span>
			</div>
			<div class="h-8 w-px bg-border/50"></div>
			<div class="flex flex-col items-center">
				<span class="text-lg font-bold text-rose-500 dark:text-rose-400">{totalFat}g</span>
				<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
					Fat
				</span>
			</div>
		</div>
	</div>
</div>
