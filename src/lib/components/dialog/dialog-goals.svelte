<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
		InputGroupText
	} from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { getProfile, updateProfile } from '$lib/remote/profile.remote';
	import { getLatestWeight } from '$lib/remote/weight.remote';
	import {
		calculateAge,
		calculateBMR,
		calculateCalorieGoal,
		calculateTDEE,
		calculateWaterGoal,
		kgToLbs,
		lbsToKg
	} from '$lib/utils/calculations';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import TargetIcon from '@lucide/svelte/icons/target';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const initialProfile = await getProfile();
	const initialWeight = await getLatestWeight();

	const profile = $derived(getProfile().current ?? initialProfile);
	const latestWeight = $derived(getLatestWeight().current ?? initialWeight);

	const units = $derived(profile?.units ?? 'imperial');

	let calorieGoal = $state('');
	let waterGoal = $state('');
	let weightGoal = $state('');
	let saving = $state(false);

	const weightUnit = $derived(units === 'imperial' ? 'lbs' : 'kg');
	const waterUnit = $derived(units === 'imperial' ? 'oz' : 'ml');

	function recalculateGoals() {
		if (!profile || !latestWeight) {
			toast.error('Need weight and profile data to recalculate');
			return;
		}

		const heightCm = profile.height ?? 0;
		const currentWeightValue = latestWeight.weight;
		const goalWeightValue = parseFloat(weightGoal) || 0;
		const age = calculateAge(profile.birthDate);
		const activityLevel = profile.activityLevel ?? 'moderate';

		const weightKg = units === 'imperial' ? lbsToKg(currentWeightValue) : currentWeightValue;
		const bmr = calculateBMR(heightCm, weightKg, age, profile.sex);
		const tdee = calculateTDEE(bmr, activityLevel);
		const newCalorieGoal = calculateCalorieGoal(tdee, currentWeightValue, goalWeightValue);

		const weightLbs = units === 'imperial' ? currentWeightValue : kgToLbs(currentWeightValue);
		const newWaterGoal = calculateWaterGoal(weightLbs, units);

		calorieGoal = String(newCalorieGoal);
		waterGoal = String(newWaterGoal);
	}

	$effect(() => {
		if (open && profile) {
			calorieGoal = String(profile.calorieGoal ?? 2200);
			waterGoal = String(profile.waterGoal ?? (units === 'imperial' ? 64 : 2000));
			weightGoal = profile.weightGoal ? String(profile.weightGoal) : '';
		}
	});

	async function handleSave() {
		if (!calorieGoal) return;

		saving = true;

		try {
			await updateProfile({
				calorieGoal: parseInt(calorieGoal),
				waterGoal: parseInt(waterGoal),
				...(weightGoal && { weightGoal: parseFloat(weightGoal) })
			}).updates(getProfile());
			open = false;
		} catch (err) {
			console.error('Failed to save settings:', err);
			toast.error('Failed to save settings');
		} finally {
			saving = false;
		}
	}
</script>

<ResponsiveDialog
	bind:open
	title="Goals"
	subtitle="Set your nutrition targets"
	contentClass="sm:max-w-md"
>
	{#snippet icon()}
		<TargetIcon class="size-5 text-muted-foreground" />
	{/snippet}

	<div class="space-y-6 py-4">
		<div class="space-y-2">
			<Label for="weightGoal">Goal Weight</Label>
			<InputGroup>
				<InputGroupInput
					id="weightGoal"
					type="number"
					step="0.1"
					placeholder="Enter goal weight"
					bind:value={weightGoal}
				/>
				<InputGroupAddon>
					<InputGroupText>{weightUnit}</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</div>

		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<Label for="calorieGoal">Daily Calorie Goal</Label>
				<button
					type="button"
					class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					onclick={recalculateGoals}
				>
					<CalculatorIcon class="size-3" />
					Recalculate
				</button>
			</div>
			<InputGroup>
				<InputGroupInput
					id="calorieGoal"
					type="number"
					placeholder="2200"
					bind:value={calorieGoal}
				/>
				<InputGroupAddon>
					<InputGroupText>kcal</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</div>

		<div class="space-y-2">
			<Label for="waterGoal">Daily Water Goal</Label>
			<InputGroup>
				<InputGroupInput id="waterGoal" type="number" placeholder="64" bind:value={waterGoal} />
				<InputGroupAddon>
					<InputGroupText>{waterUnit}</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</div>

		<Button onclick={handleSave} disabled={!calorieGoal || saving} class="w-full">
			{#if saving}
				<Loader2Icon class="mr-2 size-4 animate-spin" />
				Saving...
			{:else}
				Save Settings
			{/if}
		</Button>
	</div>
</ResponsiveDialog>
