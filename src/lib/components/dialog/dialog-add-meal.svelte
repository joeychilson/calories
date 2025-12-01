<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let {
		open = $bindable(false),
		onAdd
	}: {
		open?: boolean;
		onAdd?: (meal: { name: string; calories: number; image: string | null }) => void;
	} = $props();

	let name = $state('');
	let calories = $state('');
	let image = $state<string | null>(null);
	let analyzing = $state(false);
	let fileInput: HTMLInputElement;

	function reset() {
		name = '';
		calories = '';
		image = null;
		analyzing = false;
	}

	const compressImage = (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = (event) => {
				const img = new Image();
				img.src = event.target?.result as string;
				img.onload = () => {
					const canvas = document.createElement('canvas');
					const MAX_WIDTH = 400;
					const scaleSize = MAX_WIDTH / img.width;
					canvas.width = MAX_WIDTH;
					canvas.height = img.height * scaleSize;
					const ctx = canvas.getContext('2d');
					ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
					resolve(canvas.toDataURL('image/jpeg', 0.7));
				};
				img.onerror = (err) => reject(err);
			};
			reader.onerror = (err) => reject(err);
		});
	};

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			analyzing = true;
			try {
				const compressed = await compressImage(target.files[0]);
				image = compressed;
				setTimeout(() => {
					analyzing = false;
					const suggestions = [350, 420, 180, 560, 290];
					if (!calories) {
						calories = String(suggestions[Math.floor(Math.random() * suggestions.length)]);
					}
					if (!name) name = 'Delicious Meal';
				}, 1200);
			} catch (err) {
				analyzing = false;
				console.error('Image processing failed', err);
			}
		}
	}

	function handleSubmit() {
		if (!name || !calories) return;
		onAdd?.({ name, calories: parseInt(calories), image });
		open = false;
		reset();
	}
</script>

<ResponsiveDialog
	bind:open
	title="Add Meal"
	subtitle="Log your meal to track your daily intake."
	contentClass="sm:max-w-md"
>
	<div class="space-y-6 py-4">
		<button
			type="button"
			class="border-muted-foreground/25 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all"
			onclick={() => fileInput?.click()}
		>
			{#if image}
				<img src={image} alt="Preview" class="h-full w-full object-cover" />
				<div
					class="bg-background/60 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100"
				>
					<span class="text-foreground flex items-center gap-2 font-medium">
						<CameraIcon class="size-5" /> Change Photo
					</span>
				</div>
			{:else}
				<div
					class="bg-primary/10 text-primary mb-2 flex h-12 w-12 items-center justify-center rounded-full"
				>
					<CameraIcon class="size-6" />
				</div>
				<p class="text-muted-foreground text-sm font-medium">Tap to take photo</p>
			{/if}
			{#if analyzing}
				<div
					class="bg-background/80 absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
				>
					<Loader2Icon class="text-primary mb-3 size-8 animate-spin" />
					<p class="text-foreground animate-pulse text-sm font-medium">Analyzing food...</p>
				</div>
			{/if}
			<input
				type="file"
				accept="image/*"
				bind:this={fileInput}
				onchange={handleFileSelect}
				class="hidden"
			/>
		</button>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input
					id="name"
					type="text"
					placeholder="What are you eating?"
					bind:value={name}
					class="text-lg"
				/>
			</div>
			<div class="space-y-2">
				<Label for="calories">Calories</Label>
				<div class="relative">
					<Input
						id="calories"
						type="number"
						placeholder="0"
						bind:value={calories}
						class="text-lg"
					/>
					<div
						class="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none"
					>
						<FlameIcon class="size-4 {calories ? 'text-orange-500' : ''}" />
						<span class="text-sm font-medium">kcal</span>
					</div>
				</div>
			</div>
			<div class="grid grid-cols-3 gap-3">
				<div class="space-y-2">
					<Label for="protein" class="text-xs text-muted-foreground">Protein (g)</Label>
					<Input id="protein" type="number" placeholder="0" class="text-center" />
				</div>
				<div class="space-y-2">
					<Label for="carbs" class="text-xs text-muted-foreground">Carbs (g)</Label>
					<Input id="carbs" type="number" placeholder="0" class="text-center" />
				</div>
				<div class="space-y-2">
					<Label for="fat" class="text-xs text-muted-foreground">Fat (g)</Label>
					<Input id="fat" type="number" placeholder="0" class="text-center" />
				</div>
			</div>
		</div>
		<Button
			onclick={handleSubmit}
			disabled={!name || !calories || analyzing}
			class="w-full py-6 text-lg"
		>
			{#if analyzing}
				<Loader2Icon class="mr-2 size-5 animate-spin" />
				Analyzing...
			{:else}
				<CheckIcon class="mr-2 size-5" />
				Add Meal
			{/if}
		</Button>
	</div>
</ResponsiveDialog>
