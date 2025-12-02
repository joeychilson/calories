<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
		InputGroupText
	} from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		onSave,
		currentWeight = 0,
		unit = 'lbs'
	}: {
		open?: boolean;
		onSave?: (weight: number) => void;
		currentWeight?: number;
		unit?: string;
	} = $props();

	let weight = $state('');

	$effect(() => {
		if (open && currentWeight) {
			weight = String(currentWeight);
		}
	});

	function handleSubmit() {
		if (!weight) return;
		onSave?.(parseFloat(weight));
		open = false;
	}
</script>

<ResponsiveDialog
	bind:open
	title="Log Weight"
	subtitle="Track your progress over time."
	contentClass="sm:max-w-md"
>
	<div class="space-y-6 py-4">
		<div class="space-y-2">
			<Label for="weight">Current Weight</Label>
			<InputGroup>
				<InputGroupInput
					id="weight"
					type="number"
					step="0.1"
					placeholder="0.0"
					bind:value={weight}
				/>
				<InputGroupAddon>
					<InputGroupText>{unit}</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</div>

		<Button onclick={handleSubmit} disabled={!weight} class="w-full">Save Weight</Button>
	</div>
</ResponsiveDialog>
