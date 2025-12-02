<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
		InputGroupText
	} from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { optimizeCalories, updateSettings } from '$lib/remote/settings.remote';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		currentCalorieGoal = 2200,
		currentWeightGoal = null as number | null,
		currentWeight = null as number | null,
		weightUnit = 'lbs',
		onSave
	}: {
		open?: boolean;
		currentCalorieGoal?: number;
		currentWeightGoal?: number | null;
		currentWeight?: number | null;
		weightUnit?: string;
		onSave?: () => void;
	} = $props();

	let calorieGoal = $state('');
	let weightGoal = $state('');
	let saving = $state(false);
	let optimizing = $state(false);
	let aiResult = $state<{ calories: number; timeline: string; explanation: string } | null>(null);

	$effect(() => {
		if (open) {
			calorieGoal = String(currentCalorieGoal);
			weightGoal = currentWeightGoal ? String(currentWeightGoal) : '';
			aiResult = null;
		}
	});

	async function handleOptimize() {
		if (!currentWeight) {
			toast.error('Please log your current weight first');
			return;
		}

		if (!weightGoal) {
			toast.error('Please enter a goal weight');
			return;
		}

		optimizing = true;
		aiResult = null;

		try {
			const result = await optimizeCalories({
				currentWeight,
				goalWeight: parseFloat(weightGoal),
				unit: weightUnit
			});

			aiResult = result;
			calorieGoal = String(result.calories);
		} catch (err) {
			console.error('Optimization failed:', err);
			toast.error('Failed to get AI recommendation');
		} finally {
			optimizing = false;
		}
	}

	async function handleSave() {
		if (!calorieGoal) return;

		saving = true;

		try {
			await updateSettings({
				calorieGoal: parseInt(calorieGoal),
				weightGoal: weightGoal ? parseFloat(weightGoal) : undefined
			});
			onSave?.();
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
	title="Goals & Settings"
	subtitle="Set your daily calorie target"
	contentClass="sm:max-w-md"
>
	<div class="py-4 space-y-6">
		{#if currentWeight}
			<div class="bg-muted/30 border border-muted rounded-lg p-3 flex items-center gap-3">
				<div class="bg-background p-2 rounded-md shadow-sm">
					<ScaleIcon class="size-4 text-muted-foreground" />
				</div>
				<div>
					<p class="text-xs text-muted-foreground font-medium">Current Weight</p>
					<p class="text-sm font-bold">{currentWeight} {weightUnit}</p>
				</div>
			</div>
		{/if}

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

		{#if currentWeight && weightGoal}
			<Button variant="outline" class="w-full" onclick={handleOptimize} disabled={optimizing}>
				{#if optimizing}
					<Loader2Icon class="mr-2 size-4 animate-spin" />
					Calculating...
				{:else}
					<SparklesIcon class="mr-2 size-4 text-primary" />
					Calculate with AI
				{/if}
			</Button>
		{/if}

		{#if aiResult}
			<div class="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
				<div class="flex items-center gap-2">
					<SparklesIcon class="size-3 text-primary" />
					<span class="text-xs font-bold text-primary">AI Recommendation</span>
				</div>
				<div class="space-y-1">
					<div class="flex justify-between items-baseline">
						<span class="text-xs text-muted-foreground">Daily Calories</span>
						<span class="text-lg font-bold">{aiResult.calories}</span>
					</div>
					<div class="flex justify-between items-baseline">
						<span class="text-xs text-muted-foreground">Timeline</span>
						<span class="text-sm font-medium text-emerald-600">{aiResult.timeline}</span>
					</div>
				</div>
				<p class="text-xs text-muted-foreground leading-relaxed">{aiResult.explanation}</p>
			</div>
		{/if}

		<div class="space-y-2">
			<Label for="calorieGoal">Daily Calorie Goal</Label>
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
			{#if !aiResult}
				<p class="text-xs text-muted-foreground">
					Or enter your goal weight above and let AI calculate the optimal calories.
				</p>
			{/if}
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
