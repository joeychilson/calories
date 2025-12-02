<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { Label } from '$lib/components/ui/label';
	import { analyzeMealImage } from '$lib/remote/meals.remote';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	type MealData = {
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
		sodium?: number;
		cholesterol?: number;
		fiber?: number;
		sugar?: number;
		imageKey?: string;
	};

	let {
		open = $bindable(false),
		onAdd
	}: {
		open?: boolean;
		onAdd?: (meal: MealData) => void;
	} = $props();

	let name = $state('');
	let servings = $state('1');
	let calories = $state('');
	let protein = $state('');
	let carbs = $state('');
	let fat = $state('');
	let imagePreview = $state<string | null>(null);
	let imageKey = $state<string | null>(null);
	let analyzing = $state(false);
	let analyzed = $state(false);
	let fileInput: HTMLInputElement;

	function reset() {
		name = '';
		servings = '1';
		calories = '';
		protein = '';
		carbs = '';
		fat = '';
		imagePreview = null;
		imageKey = null;
		analyzing = false;
		analyzed = false;
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				resolve(result);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];

		imagePreview = URL.createObjectURL(file);
		analyzing = true;
		analyzed = false;

		try {
			const base64 = await fileToBase64(file);
			const mimeType = file.type || 'image/jpeg';

			const result = await analyzeMealImage({
				imageData: base64,
				mimeType,
				fileName: file.name
			});

			name = result.name;
			servings = '1';
			calories = String(result.calories);
			protein = String(result.protein);
			carbs = String(result.carbs);
			fat = String(result.fat);
			imageKey = result.imageKey;
			analyzed = true;

			toast.success('Meal analyzed!', {
				description: `${result.name} - ${result.calories} kcal`
			});
		} catch (err: unknown) {
			console.error('Analysis failed', err);
			const message = err instanceof Error ? err.message : 'Failed to analyze meal';
			toast.error(message);
			imagePreview = null;
			imageKey = null;
		} finally {
			analyzing = false;
		}
	}

	function clearImage() {
		imagePreview = null;
		imageKey = null;
		analyzed = false;
		if (fileInput) fileInput.value = '';
	}

	function handleSubmit() {
		if (!name || !calories) return;

		onAdd?.({
			name,
			servings: parseFloat(servings) || 1,
			calories: parseInt(calories),
			protein: protein ? parseInt(protein) : undefined,
			carbs: carbs ? parseInt(carbs) : undefined,
			fat: fat ? parseInt(fat) : undefined,
			imageKey: imageKey || undefined
		});

		open = false;
		reset();
	}

	function handleServingsInput(e: Event & { currentTarget: HTMLInputElement }) {
		const newVal = e.currentTarget.value;
		const oldValNum = parseFloat(servings);
		const newValNum = parseFloat(newVal);

		// If we have valid numbers for both and they are different
		if (
			!isNaN(oldValNum) &&
			!isNaN(newValNum) &&
			oldValNum > 0 &&
			newValNum > 0 &&
			oldValNum !== newValNum
		) {
			const ratio = newValNum / oldValNum;

			if (calories) calories = String(Math.round(parseInt(calories) * ratio));
			if (protein) protein = String(Math.round(parseInt(protein) * ratio));
			if (carbs) carbs = String(Math.round(parseInt(carbs) * ratio));
			if (fat) fat = String(Math.round(parseInt(fat) * ratio));
		}

		servings = newVal;
	}
</script>

<ResponsiveDialog
	bind:open
	title="Log Meal"
	subtitle="Snap a photo for instant AI analysis."
	contentClass="sm:max-w-md"
>
	<div class="space-y-6 py-4">
		<!-- Image Upload Area -->
		<div class="relative">
			<button
				type="button"
				class="border-muted-foreground/20 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all"
				onclick={() => fileInput?.click()}
				disabled={analyzing}
			>
				{#if imagePreview}
					<img src={imagePreview} alt="Preview" class="h-full w-full object-cover" />
					{#if analyzed}
						<div
							class="absolute top-3 left-3 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"
						>
							<SparklesIcon class="size-3" />
							AI Analyzed
						</div>
					{/if}
				{:else}
					<div class="bg-background p-4 rounded-full shadow-sm mb-2">
						<CameraIcon class="size-6 text-muted-foreground" />
					</div>
					<p class="text-sm font-medium">Take a photo</p>
				{/if}

				{#if analyzing}
					<div
						class="bg-background/90 absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
					>
						<div class="relative">
							<Loader2Icon class="text-primary size-8 animate-spin" />
						</div>
						<p class="text-sm font-medium mt-3">Analyzing...</p>
					</div>
				{/if}

				<input
					type="file"
					accept="image/jpeg,image/png,image/webp,image/heic"
					capture="environment"
					bind:this={fileInput}
					onchange={handleFileSelect}
					class="hidden"
				/>
			</button>

			{#if imagePreview && !analyzing}
				<button
					type="button"
					class="absolute -top-2 -right-2 bg-background shadow-sm border p-1.5 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
					onclick={clearImage}
				>
					<XIcon class="size-3" />
				</button>
			{/if}
		</div>

		<!-- Form Fields -->
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Meal Name</Label>
				<InputGroup.Root>
					<InputGroup.Input
						id="name"
						type="text"
						placeholder="e.g., Grilled Chicken Salad"
						bind:value={name}
					/>
				</InputGroup.Root>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="calories">Calories</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="calories"
							type="number"
							inputmode="numeric"
							placeholder="0"
							bind:value={calories}
						/>
						<InputGroup.Addon>
							<InputGroup.Text>kcal</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>

				<div class="space-y-2">
					<Label for="servings">Servings</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="servings"
							type="number"
							inputmode="numeric"
							step="0.5"
							min="0"
							placeholder="1"
							value={servings}
							oninput={handleServingsInput}
						/>
					</InputGroup.Root>
				</div>
			</div>

			<!-- Macros -->
			<div class="grid grid-cols-3 gap-3">
				<div class="space-y-2">
					<Label for="protein" class="text-xs text-muted-foreground">Protein</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="protein"
							type="number"
							inputmode="numeric"
							placeholder="0"
							bind:value={protein}
							class="text-center"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="px-2">g</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
				<div class="space-y-2">
					<Label for="carbs" class="text-xs text-muted-foreground">Carbs</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="carbs"
							type="number"
							inputmode="numeric"
							placeholder="0"
							bind:value={carbs}
							class="text-center"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="px-2">g</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
				<div class="space-y-2">
					<Label for="fat" class="text-xs text-muted-foreground">Fat</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="fat"
							type="number"
							inputmode="numeric"
							placeholder="0"
							bind:value={fat}
							class="text-center"
						/>
						<InputGroup.Addon>
							<InputGroup.Text class="px-2">g</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</div>
			</div>
		</div>

		<!-- Submit Button -->
		<Button
			onclick={handleSubmit}
			disabled={!name || !calories || analyzing}
			class="w-full text-base font-bold"
		>
			{#if analyzing}
				<Loader2Icon class="mr-2 size-5 animate-spin" />
				Analyzing...
			{:else}
				<CheckIcon class="mr-2 size-5" />
				Log Meal
			{/if}
		</Button>
	</div>
</ResponsiveDialog>
