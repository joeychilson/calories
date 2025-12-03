<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
		InputGroupText
	} from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { updateProfile } from '$lib/remote/profile.remote';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		currentCalorieGoal = 2200,
		currentWaterGoal = 64,
		currentWeightGoal = null as number | null,
		currentWeight = null as number | null,
		units = 'imperial',
		onSave
	}: {
		open?: boolean;
		currentCalorieGoal?: number;
		currentWaterGoal?: number;
		currentWeightGoal?: number | null;
		currentWeight?: number | null;
		units?: string;
		onSave?: () => void;
	} = $props();

	let calorieGoal = $state('');
	let waterGoal = $state('');
	let weightGoal = $state('');
	let saving = $state(false);

	let weightUnit = $derived(units === 'imperial' ? 'lbs' : 'kg');
	let waterUnit = $derived(units === 'imperial' ? 'oz' : 'ml');

	$effect(() => {
		if (open) {
			calorieGoal = String(currentCalorieGoal);
			waterGoal = String(currentWaterGoal);
			weightGoal = currentWeightGoal ? String(currentWeightGoal) : '';
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
	subtitle="Set your daily targets"
	contentClass="sm:max-w-md"
>
	<div class="space-y-6 py-4">
		{#if currentWeight}
			<div class="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-3">
				<div class="rounded-md bg-background p-2 shadow-sm">
					<ScaleIcon class="size-4 text-muted-foreground" />
				</div>
				<div>
					<p class="text-xs font-medium text-muted-foreground">Current Weight</p>
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
