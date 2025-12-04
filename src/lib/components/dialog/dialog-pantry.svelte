<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { InputGroup, InputGroupInput } from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import {
		addPantryItem,
		addPantryItems,
		deletePantryItem,
		getPantryImageUploadUrl,
		getPantryItems,
		scanPantryImage,
		updatePantryItem
	} from '$lib/remote/pantry.remote';
	import { type PantryCategory } from '$lib/server/schema';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefrigeratorIcon from '@lucide/svelte/icons/refrigerator';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type PantryItem = {
		id: string;
		name: string;
		category: string | null;
		quantity: number;
		unit: string;
		createdAt: string;
	};

	type ParsedReceiptItem = {
		name: string;
		category?: PantryCategory;
		quantity?: number;
		unit?: string;
		selected: boolean;
	};

	const initialItems = await getPantryItems();
	const items = $derived(getPantryItems().current ?? initialItems);

	let view = $state<'list' | 'add' | 'receipt-review'>('list');

	let newName = $state('');
	let newCategory = $state<PantryCategory | ''>('');
	let newQuantity = $state('1');
	let newUnit = $state('count');

	const unitOptions = [
		{ value: 'count', label: 'count' },
		{ value: 'lb', label: 'lb' },
		{ value: 'oz', label: 'oz' },
		{ value: 'kg', label: 'kg' },
		{ value: 'g', label: 'g' },
		{ value: 'gal', label: 'gal' },
		{ value: 'L', label: 'L' },
		{ value: 'ml', label: 'ml' },
		{ value: 'cup', label: 'cup' },
		{ value: 'tbsp', label: 'tbsp' },
		{ value: 'tsp', label: 'tsp' },
		{ value: 'dozen', label: 'dozen' },
		{ value: 'pack', label: 'pack' },
		{ value: 'bag', label: 'bag' },
		{ value: 'box', label: 'box' },
		{ value: 'can', label: 'can' },
		{ value: 'jar', label: 'jar' },
		{ value: 'bottle', label: 'bottle' }
	];
	let saving = $state(false);
	let editingItemId = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let analyzing = $state(false);
	let parsedItems = $state<ParsedReceiptItem[]>([]);
	let storeName = $state<string | null>(null);

	const categoryLabels: Record<string, string> = {
		protein: 'Protein',
		vegetable: 'Vegetables',
		fruit: 'Fruits',
		dairy: 'Dairy',
		grain: 'Grains',
		pantry: 'Pantry',
		beverage: 'Beverages',
		other: 'Other'
	};

	const categoryOrder = [
		'protein',
		'vegetable',
		'fruit',
		'dairy',
		'grain',
		'pantry',
		'beverage',
		'other'
	];

	const groupedItems = $derived.by(() => {
		const groups: Record<string, PantryItem[]> = {};
		for (const item of items) {
			const cat = item.category || 'other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(item);
		}
		return groups;
	});

	function resetAddForm() {
		newName = '';
		newCategory = '';
		newQuantity = '1';
		newUnit = 'count';
		editingItemId = null;
		parsedItems = [];
		storeName = null;
	}

	function goToList() {
		view = 'list';
		resetAddForm();
	}

	function startEditing(item: PantryItem) {
		editingItemId = item.id;
		newName = item.name;
		newCategory = (item.category as PantryCategory) || '';
		newQuantity = String(item.quantity ?? 1);
		newUnit = item.unit || 'count';
		view = 'add';
	}

	async function handleSaveItem() {
		if (!newName.trim()) return;

		saving = true;
		try {
			if (editingItemId) {
				await updatePantryItem({
					id: editingItemId,
					name: newName.trim(),
					category: newCategory || undefined,
					quantity: parseFloat(newQuantity) || 1,
					unit: newUnit
				}).updates(getPantryItems());
			} else {
				await addPantryItem({
					name: newName.trim(),
					category: newCategory || undefined,
					quantity: parseFloat(newQuantity) || 1,
					unit: newUnit
				}).updates(getPantryItems());
			}
			goToList();
		} catch (err) {
			console.error('Failed to save item:', err);
			toast.error(editingItemId ? 'Failed to update item' : 'Failed to add item');
		} finally {
			saving = false;
		}
	}

	async function handleDeleteItem(id: string) {
		try {
			await deletePantryItem(id).updates(getPantryItems());
		} catch (err) {
			console.error('Failed to delete item:', err);
			toast.error('Failed to remove item');
		}
	}

	async function handleScan(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];
		const mimeType = file.type || 'image/jpeg';

		analyzing = true;

		try {
			const { imageKey, uploadUrl } = await getPantryImageUploadUrl({ mimeType });

			const uploadResponse = await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: { 'Content-Type': mimeType }
			});

			if (!uploadResponse.ok) {
				throw new Error('Failed to upload image');
			}

			const result = await scanPantryImage({ imageKey, mimeType });

			storeName = result.imageType === 'receipt' ? (result.storeName ?? null) : null;
			parsedItems = result.items.map((item) => ({
				...item,
				selected: true
			}));

			if (parsedItems.length === 0) {
				toast.error('No food items found');
				return;
			}

			view = 'receipt-review';
		} catch (err: unknown) {
			console.error('Scan failed:', err);
			const message = err instanceof Error ? err.message : 'Failed to analyze image';
			toast.error(message);
		} finally {
			analyzing = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function handleAddSelectedItems() {
		const selected = parsedItems.filter((item) => item.selected);
		if (selected.length === 0) {
			toast.error('No items selected');
			return;
		}

		saving = true;
		try {
			await addPantryItems(
				selected.map((item) => ({
					name: item.name,
					category: item.category,
					quantity: item.quantity,
					unit: item.unit
				}))
			).updates(getPantryItems());
			goToList();
		} catch (err) {
			console.error('Failed to add items:', err);
			toast.error('Failed to add items');
		} finally {
			saving = false;
		}
	}

	function toggleItemSelection(index: number) {
		parsedItems[index].selected = !parsedItems[index].selected;
	}

	function selectAllItems() {
		parsedItems = parsedItems.map((item) => ({ ...item, selected: true }));
	}

	function deselectAllItems() {
		parsedItems = parsedItems.map((item) => ({ ...item, selected: false }));
	}

	$effect(() => {
		if (!open) {
			view = 'list';
			resetAddForm();
		}
	});
</script>

<ResponsiveDialog
	bind:open
	title={view === 'list'
		? 'My Pantry'
		: view === 'add'
			? editingItemId
				? 'Edit Item'
				: 'Add Item'
			: 'Review Items'}
	subtitle={view === 'list'
		? `${items.length} items`
		: view === 'receipt-review' && storeName
			? `From ${storeName}`
			: undefined}
	onBack={view !== 'list' ? goToList : undefined}
	contentClass="sm:max-w-lg"
>
	{#snippet icon()}
		<RefrigeratorIcon class="size-5 text-muted-foreground" />
	{/snippet}

	<div class="py-4">
		{#if view === 'list'}
			<div class="space-y-4">
				<div class="flex gap-2">
					<Button variant="outline" class="flex-1" onclick={() => (view = 'add')}>
						<PlusIcon class="size-4 mr-2" />
						Add Item
					</Button>
					<Button
						variant="outline"
						class="flex-1"
						onclick={() => fileInput?.click()}
						disabled={analyzing}
					>
						{#if analyzing}
							<Loader2Icon class="size-4 mr-2 animate-spin" />
							Scanning...
						{:else}
							<CameraIcon class="size-4 mr-2" />
							Scan
						{/if}
					</Button>
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp,image/heic"
						capture="environment"
						bind:this={fileInput}
						onchange={handleScan}
						class="hidden"
					/>
				</div>

				{#if items.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="rounded-full bg-muted p-4 mb-4">
							<RefrigeratorIcon class="size-8 text-muted-foreground" />
						</div>
						<p class="font-medium text-foreground">Your pantry is empty</p>
						<p class="text-sm text-muted-foreground mt-1">Add items manually or scan a receipt</p>
					</div>
				{:else}
					<div class="space-y-4 max-h-[400px] overflow-y-auto -mx-1 px-1">
						{#each categoryOrder as category (category)}
							{#if groupedItems[category]?.length}
								<div>
									<h3
										class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1"
									>
										{categoryLabels[category]}
									</h3>
									<div class="rounded-lg border bg-card overflow-hidden divide-y">
										{#each groupedItems[category] as item (item.id)}
											<div
												class="flex items-center justify-between py-2.5 px-3 hover:bg-muted/30 transition-colors group"
											>
												<div class="flex items-center gap-3 min-w-0">
													<span class="font-medium truncate">{item.name}</span>
													{#if item.quantity && item.unit}
														<span
															class="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
														>
															{item.quantity}
															{item.unit}
														</span>
													{/if}
												</div>
												<div
													class="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
												>
													<button
														type="button"
														class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
														onclick={() => startEditing(item)}
													>
														<PencilIcon class="size-4" />
													</button>
													<button
														type="button"
														class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
														onclick={() => handleDeleteItem(item.id)}
													>
														<TrashIcon class="size-4" />
													</button>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{:else if view === 'add'}
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="itemName">Item Name</Label>
					<InputGroup>
						<InputGroupInput
							id="itemName"
							type="text"
							placeholder="e.g., Chicken Breast"
							bind:value={newName}
						/>
					</InputGroup>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="category">Category</Label>
						<Select type="single" bind:value={newCategory}>
							<SelectTrigger class="w-full">
								{#if newCategory}
									{categoryLabels[newCategory]}
								{:else}
									<span class="text-muted-foreground">Select...</span>
								{/if}
							</SelectTrigger>
							<SelectContent>
								{#each categoryOrder as cat (cat)}
									<SelectItem value={cat}>{categoryLabels[cat]}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>

					<div class="space-y-2">
						<Label for="quantity">Quantity</Label>
						<div class="flex gap-2">
							<InputGroup class="flex-1">
								<InputGroupInput
									id="quantity"
									type="number"
									step="any"
									min="0"
									bind:value={newQuantity}
								/>
							</InputGroup>
							<Select type="single" bind:value={newUnit}>
								<SelectTrigger class="w-24">
									{newUnit}
								</SelectTrigger>
								<SelectContent>
									{#each unitOptions as unit (unit.value)}
										<SelectItem value={unit.value}>{unit.label}</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				<Button onclick={handleSaveItem} disabled={!newName.trim() || saving} class="w-full">
					{#if saving}
						<Loader2Icon class="size-4 mr-2 animate-spin" />
						{editingItemId ? 'Saving...' : 'Adding...'}
					{:else}
						<CheckIcon class="size-4 mr-2" />
						{editingItemId ? 'Save Changes' : 'Add Item'}
					{/if}
				</Button>
			</div>
		{:else if view === 'receipt-review'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">
						{parsedItems.filter((i) => i.selected).length} of {parsedItems.length} selected
					</span>
					<div class="flex gap-2">
						<button
							type="button"
							class="text-xs text-primary hover:underline"
							onclick={selectAllItems}
						>
							Select all
						</button>
						<button
							type="button"
							class="text-xs text-muted-foreground hover:underline"
							onclick={deselectAllItems}
						>
							Clear
						</button>
					</div>
				</div>

				<div class="space-y-1 max-h-[350px] overflow-y-auto">
					{#each parsedItems as item, index (index)}
						<button
							type="button"
							class="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 text-left transition-colors {item.selected
								? 'bg-primary/5'
								: ''}"
							onclick={() => toggleItemSelection(index)}
						>
							<div
								class="size-5 rounded border-2 flex items-center justify-center transition-colors {item.selected
									? 'bg-primary border-primary text-primary-foreground'
									: 'border-muted-foreground/30'}"
							>
								{#if item.selected}
									<CheckIcon class="size-3" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div class="truncate font-medium">{item.name}</div>
								<div class="text-xs text-muted-foreground">
									{#if item.quantity && item.unit}
										{item.quantity} {item.unit} ·
									{/if}
									{categoryLabels[item.category ?? 'other']}
								</div>
							</div>
						</button>
					{/each}
				</div>

				<Button
					onclick={handleAddSelectedItems}
					disabled={parsedItems.filter((i) => i.selected).length === 0 || saving}
					class="w-full"
				>
					{#if saving}
						<Loader2Icon class="size-4 mr-2 animate-spin" />
						Adding...
					{:else}
						<CheckIcon class="size-4 mr-2" />
						Add {parsedItems.filter((i) => i.selected).length} Items
					{/if}
				</Button>
			</div>
		{/if}
	</div>
</ResponsiveDialog>
