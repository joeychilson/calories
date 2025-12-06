<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { InputGroup, InputGroupInput } from '$lib/components/ui/input-group';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { PANTRY_CATEGORY_LABELS, PANTRY_CATEGORY_ORDER } from '$lib/constants';
	import {
		addPantryItem,
		addPantryItems,
		deletePantryItem,
		getPantryImageUploadUrl,
		getPantryItems,
		scanPantryImage,
		updatePantryItem
	} from '$lib/remote/pantry.remote';
	import {
		addShoppingListItem,
		addShoppingListItems,
		clearCheckedItems,
		createShoppingList,
		deleteShoppingList,
		deleteShoppingListItem,
		getShoppingListImageUploadUrl,
		getShoppingListMarkdown,
		getShoppingLists,
		markItemsBoughtAndAddToPantry,
		scanShoppingList,
		toggleShoppingListItem,
		updateShoppingList,
		updateShoppingListItem
	} from '$lib/remote/shopping.remote';
	import { type PantryCategory } from '$lib/server/schema';
	import CheckIcon from '@lucide/svelte/icons/check';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefrigeratorIcon from '@lucide/svelte/icons/refrigerator';
	import ScanIcon from '@lucide/svelte/icons/scan';
	import ShoppingCartIcon from '@lucide/svelte/icons/shopping-cart';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import ResponsiveDialog from './dialog-responsive.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let activeTab = $state<'pantry' | 'shopping'>('pantry');

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

	type ParsedShoppingItem = {
		name: string;
		category?: PantryCategory;
		quantity?: number;
		unit?: string;
		selected: boolean;
	};

	type ShoppingListItem = {
		id: string;
		name: string;
		category: string | null;
		quantity: number;
		unit: string;
		checked: boolean;
		createdAt: string;
	};

	type ShoppingList = {
		id: string;
		name: string;
		createdAt: string;
		updatedAt: string;
		items: ShoppingListItem[];
	};

	const initialPantryItems = await getPantryItems();
	const pantryItems = $derived(getPantryItems().current ?? initialPantryItems);

	const initialShoppingLists = await getShoppingLists();
	const shoppingLists = $derived(getShoppingLists().current ?? initialShoppingLists);

	let pantryView = $state<'list' | 'add' | 'receipt-review'>('list');
	let shoppingView = $state<'list' | 'add-item' | 'add-list' | 'edit-list' | 'scan-review'>('list');

	let newName = $state('');
	let newCategory = $state<PantryCategory | ''>('');
	let newQuantity = $state('1');
	let newUnit = $state('count');
	let editingItemId = $state<string | null>(null);
	let saving = $state(false);

	let fileInput = $state<HTMLInputElement | null>(null);
	let analyzing = $state(false);
	let parsedItems = $state<ParsedReceiptItem[]>([]);
	let storeName = $state<string | null>(null);

	let shoppingScanInput = $state<HTMLInputElement | null>(null);
	let shoppingAnalyzing = $state(false);
	let parsedShoppingItems = $state<ParsedShoppingItem[]>([]);
	let shoppingTruncatedMessage = $state<string | null>(null);

	let selectedListId = $state<string | undefined>(undefined);
	let newListName = $state('');
	let editingListId = $state<string | null>(null);

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

	const groupedPantryItems = $derived.by(() => {
		const groups: Record<string, PantryItem[]> = {};
		for (const item of pantryItems) {
			const cat = item.category || 'other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(item);
		}
		return groups;
	});

	const selectedList = $derived(
		shoppingLists.find((l) => l.id === selectedListId) ?? shoppingLists[0]
	);
	const checkedItems = $derived(selectedList?.items.filter((i) => i.checked) ?? []);
	const uncheckedItems = $derived(selectedList?.items.filter((i) => !i.checked) ?? []);

	const groupedUncheckedItems = $derived.by(() => {
		const groups: Record<string, ShoppingListItem[]> = {};
		for (const item of uncheckedItems) {
			const cat = item.category || 'other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(item);
		}
		return groups;
	});

	const dialogTitle = $derived.by(() => {
		if (activeTab === 'pantry') {
			if (pantryView === 'add') return editingItemId ? 'Edit Item' : 'Add to Pantry';
			if (pantryView === 'receipt-review') return 'Review Items';
			return 'Pantry';
		} else {
			if (shoppingView === 'add-item') return editingItemId ? 'Edit Item' : 'Add to List';
			if (shoppingView === 'add-list') return 'New List';
			if (shoppingView === 'edit-list') return 'Edit List';
			if (shoppingView === 'scan-review') return 'Review Items';
			return 'Shopping';
		}
	});

	const dialogSubtitle = $derived.by(() => {
		if (activeTab === 'pantry') {
			if (pantryView === 'receipt-review' && storeName) return `From ${storeName}`;
			if (pantryView === 'list') return 'What you have on hand';
			return undefined;
		}
		if (activeTab === 'shopping') {
			if (shoppingView === 'list') return 'What you need to buy';
			if (shoppingView === 'scan-review' && shoppingTruncatedMessage)
				return shoppingTruncatedMessage;
			return undefined;
		}
		return undefined;
	});

	const showBackButton = $derived(
		(activeTab === 'pantry' && pantryView !== 'list') ||
			(activeTab === 'shopping' && shoppingView !== 'list')
	);

	function resetForm() {
		newName = '';
		newCategory = '';
		newQuantity = '1';
		newUnit = 'count';
		editingItemId = null;
		parsedItems = [];
		storeName = null;
		newListName = '';
		editingListId = null;
		parsedShoppingItems = [];
		shoppingTruncatedMessage = null;
	}

	function goToList() {
		if (activeTab === 'pantry') {
			pantryView = 'list';
		} else {
			shoppingView = 'list';
		}
		resetForm();
	}

	function startEditingPantryItem(item: PantryItem) {
		editingItemId = item.id;
		newName = item.name;
		newCategory = (item.category as PantryCategory) || '';
		newQuantity = String(item.quantity ?? 1);
		newUnit = item.unit || 'count';
		pantryView = 'add';
	}

	async function handleSavePantryItem() {
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

	async function handleDeletePantryItem(id: string) {
		try {
			await deletePantryItem(id).updates(getPantryItems());
		} catch (err) {
			console.error('Failed to delete item:', err);
			toast.error('Failed to remove item');
		}
	}

	const MAX_FILE_SIZE = 15 * 1024 * 1024;

	async function handleScan(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];

		if (file.size > MAX_FILE_SIZE) {
			toast.error('Image is too large. Please use an image under 15MB.');
			return;
		}

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

			pantryView = 'receipt-review';
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

	const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
	const MAX_TEXT_SIZE = 50 * 1024; // 50KB
	const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
	const TEXT_TYPES = ['text/plain', 'text/markdown'];

	async function handleShoppingScan(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];
		const isImage =
			IMAGE_TYPES.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|webp|heic)$/i);
		const isText = TEXT_TYPES.includes(file.type) || file.name.match(/\.(txt|md)$/i);

		if (!isImage && !isText) {
			toast.error('Please select an image (jpg, png, webp) or text file (.txt, .md)');
			return;
		}

		if (isImage && file.size > MAX_IMAGE_SIZE) {
			toast.error('Image is too large. Please use an image under 15MB.');
			return;
		}

		if (isText && file.size > MAX_TEXT_SIZE) {
			toast.error('File is too large. Please use a file under 50KB.');
			return;
		}

		shoppingAnalyzing = true;

		try {
			if (isImage) {
				const mimeType = file.type || 'image/jpeg';
				const { imageKey, uploadUrl } = await getShoppingListImageUploadUrl({ mimeType });

				const uploadResponse = await fetch(uploadUrl, {
					method: 'PUT',
					body: file,
					headers: { 'Content-Type': mimeType }
				});

				if (!uploadResponse.ok) {
					throw new Error('Failed to upload image');
				}

				const result = await scanShoppingList({ type: 'image', imageKey, mimeType });

				parsedShoppingItems = result.items.map((item) => ({
					...item,
					selected: true
				}));

				if (parsedShoppingItems.length === 0) {
					toast.error('No items found in the image');
					return;
				}
			} else {
				const content = await file.text();
				const result = await scanShoppingList({ type: 'text', content });

				parsedShoppingItems = result.items.map((item) => ({
					...item,
					selected: true
				}));

				shoppingTruncatedMessage = result.truncatedMessage ?? null;

				if (parsedShoppingItems.length === 0) {
					toast.error('No items found in the file');
					return;
				}
			}

			shoppingView = 'scan-review';
		} catch (err: unknown) {
			console.error('Shopping scan failed:', err);
			const message = err instanceof Error ? err.message : 'Failed to analyze file';
			toast.error(message);
		} finally {
			shoppingAnalyzing = false;
			if (shoppingScanInput) shoppingScanInput.value = '';
		}
	}

	async function handleAddSelectedShoppingItems() {
		if (!selectedList) {
			toast.error('Please select a list first');
			return;
		}

		const selected = parsedShoppingItems.filter((item) => item.selected);
		if (selected.length === 0) {
			toast.error('No items selected');
			return;
		}

		saving = true;
		try {
			await addShoppingListItems({
				listId: selectedList.id,
				items: selected.map((item) => ({
					name: item.name,
					category: item.category,
					quantity: item.quantity,
					unit: item.unit
				}))
			}).updates(getShoppingLists());
			goToList();
		} catch (err) {
			console.error('Failed to add items:', err);
			toast.error('Failed to add items');
		} finally {
			saving = false;
		}
	}

	function toggleShoppingItemSelection(index: number) {
		parsedShoppingItems[index].selected = !parsedShoppingItems[index].selected;
	}

	function selectAllShoppingItems() {
		parsedShoppingItems = parsedShoppingItems.map((item) => ({ ...item, selected: true }));
	}

	function deselectAllShoppingItems() {
		parsedShoppingItems = parsedShoppingItems.map((item) => ({ ...item, selected: false }));
	}

	function startEditingShoppingItem(item: ShoppingListItem) {
		editingItemId = item.id;
		newName = item.name;
		newCategory = (item.category as PantryCategory) || '';
		newQuantity = String(item.quantity ?? 1);
		newUnit = item.unit || 'count';
		shoppingView = 'add-item';
	}

	function startEditingList(list: ShoppingList) {
		editingListId = list.id;
		newListName = list.name;
		shoppingView = 'edit-list';
	}

	async function handleSaveShoppingItem() {
		if (!newName.trim() || !selectedList) return;

		saving = true;
		try {
			if (editingItemId) {
				await updateShoppingListItem({
					id: editingItemId,
					name: newName.trim(),
					category: newCategory || undefined,
					quantity: parseFloat(newQuantity) || 1,
					unit: newUnit
				}).updates(getShoppingLists());
			} else {
				await addShoppingListItem({
					listId: selectedList.id,
					name: newName.trim(),
					category: newCategory || undefined,
					quantity: parseFloat(newQuantity) || 1,
					unit: newUnit
				}).updates(getShoppingLists());
			}
			goToList();
		} catch (err) {
			console.error('Failed to save item:', err);
			toast.error(editingItemId ? 'Failed to update item' : 'Failed to add item');
		} finally {
			saving = false;
		}
	}

	async function handleDeleteShoppingItem(id: string) {
		try {
			await deleteShoppingListItem(id).updates(getShoppingLists());
		} catch (err) {
			console.error('Failed to delete item:', err);
			toast.error('Failed to remove item');
		}
	}

	async function handleToggleItem(id: string) {
		try {
			await toggleShoppingListItem(id).updates(getShoppingLists());
		} catch (err) {
			console.error('Failed to toggle item:', err);
			toast.error('Failed to update item');
		}
	}

	async function handleUncheckAll() {
		if (checkedItems.length === 0) return;

		try {
			await Promise.all(
				checkedItems.map((item) => toggleShoppingListItem(item.id).updates(getShoppingLists()))
			);
		} catch (err) {
			console.error('Failed to uncheck items:', err);
			toast.error('Failed to uncheck items');
		}
	}

	async function handleSaveList() {
		if (!newListName.trim()) return;

		saving = true;
		try {
			if (editingListId) {
				await updateShoppingList({
					id: editingListId,
					name: newListName.trim()
				}).updates(getShoppingLists());
			} else {
				const result = await createShoppingList({
					name: newListName.trim()
				}).updates(getShoppingLists());
				selectedListId = result.id;
			}
			goToList();
		} catch (err) {
			console.error('Failed to save list:', err);
			toast.error(editingListId ? 'Failed to update list' : 'Failed to create list');
		} finally {
			saving = false;
		}
	}

	async function handleDeleteList(id: string) {
		try {
			await deleteShoppingList(id).updates(getShoppingLists());
			if (selectedListId === id) {
				selectedListId = undefined;
			}
			goToList();
		} catch (err) {
			console.error('Failed to delete list:', err);
			toast.error('Failed to delete list');
		}
	}

	async function handleMarkBoughtAndAddToPantry() {
		if (checkedItems.length === 0) return;

		saving = true;
		try {
			const result = await markItemsBoughtAndAddToPantry({
				itemIds: checkedItems.map((i) => i.id),
				addToPantry: true
			}).updates(getShoppingLists(), getPantryItems());

			if (selectedList) {
				await clearCheckedItems(selectedList.id).updates(getShoppingLists());
			}
		} catch (err) {
			console.error('Failed to process items:', err);
			toast.error('Failed to add items to pantry');
		} finally {
			saving = false;
		}
	}

	async function handleDownloadMarkdown() {
		if (!selectedList) return;

		try {
			const result = await getShoppingListMarkdown(selectedList.id);
			const blob = new Blob([result.markdown], { type: 'text/markdown' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${result.name.toLowerCase().replace(/\s+/g, '-')}.md`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download:', err);
			toast.error('Failed to download list');
		}
	}

	$effect(() => {
		if (!open) {
			pantryView = 'list';
			shoppingView = 'list';
			resetForm();
		}
	});

	$effect(() => {
		if (shoppingLists.length > 0 && !selectedListId) {
			selectedListId = shoppingLists[0].id;
		}
	});
</script>

<ResponsiveDialog
	bind:open
	title={dialogTitle}
	subtitle={dialogSubtitle}
	onBack={showBackButton ? goToList : undefined}
	contentClass="sm:max-w-lg"
>
	{#snippet icon()}
		{#if activeTab === 'pantry'}
			<RefrigeratorIcon class="size-5 text-muted-foreground" />
		{:else}
			<ShoppingCartIcon class="size-5 text-muted-foreground" />
		{/if}
	{/snippet}

	<div class="py-4">
		{#if (activeTab === 'pantry' && pantryView === 'list') || (activeTab === 'shopping' && shoppingView === 'list')}
			<div class="flex gap-1 p-1 bg-muted rounded-lg mb-4">
				<button
					type="button"
					class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors {activeTab ===
					'pantry'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = 'pantry')}
				>
					<RefrigeratorIcon class="size-4" />
					Pantry
					{#if pantryItems.length > 0}
						<span
							class="text-xs px-1.5 py-0.5 rounded-full {activeTab === 'pantry'
								? 'bg-muted'
								: 'bg-background/50'}"
						>
							{pantryItems.length}
						</span>
					{/if}
				</button>
				<button
					type="button"
					class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors {activeTab ===
					'shopping'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = 'shopping')}
				>
					<ShoppingCartIcon class="size-4" />
					Shopping
					{#if uncheckedItems.length > 0}
						<span
							class="text-xs px-1.5 py-0.5 rounded-full {activeTab === 'shopping'
								? 'bg-muted'
								: 'bg-background/50'}"
						>
							{uncheckedItems.length}
						</span>
					{/if}
				</button>
			</div>
		{/if}
		{#if activeTab === 'pantry'}
			{#if pantryView === 'list'}
				<div class="space-y-4">
					<div class="flex gap-2">
						<Button variant="outline" class="flex-1" onclick={() => (pantryView = 'add')}>
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
								<ScanIcon class="size-4 mr-2" />
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
					{#if pantryItems.length === 0}
						<div class="flex flex-col items-center justify-center py-12 text-center">
							<div class="rounded-full bg-muted p-4 mb-4">
								<RefrigeratorIcon class="size-8 text-muted-foreground" />
							</div>
							<p class="font-medium text-foreground">Your pantry is empty</p>
							<p class="text-sm text-muted-foreground mt-1">Add items manually or scan a receipt</p>
						</div>
					{:else}
						<div class="space-y-4 max-h-[350px] overflow-y-auto -mx-1 px-1">
							{#each PANTRY_CATEGORY_ORDER as category (category)}
								{#if groupedPantryItems[category]?.length}
									<div>
										<h3
											class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1"
										>
											{PANTRY_CATEGORY_LABELS[category]}
										</h3>
										<div class="rounded-lg border bg-card overflow-hidden divide-y">
											{#each groupedPantryItems[category] as item (item.id)}
												<div
													class="flex items-center justify-between py-2.5 px-3 hover:bg-muted/30 transition-colors group"
												>
													<div class="flex items-center gap-3 min-w-0">
														<span class="font-medium truncate">{item.name}</span>
														{#if item.quantity && item.unit}
															<span
																class="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
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
															onclick={() => startEditingPantryItem(item)}
														>
															<PencilIcon class="size-4" />
														</button>
														<button
															type="button"
															class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
															onclick={() => handleDeletePantryItem(item.id)}
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
			{:else if pantryView === 'add'}
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
										{PANTRY_CATEGORY_LABELS[newCategory]}
									{:else}
										<span class="text-muted-foreground">Select...</span>
									{/if}
								</SelectTrigger>
								<SelectContent>
									{#each PANTRY_CATEGORY_ORDER as cat (cat)}
										<SelectItem value={cat}>{PANTRY_CATEGORY_LABELS[cat]}</SelectItem>
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

					<Button
						onclick={handleSavePantryItem}
						disabled={!newName.trim() || saving}
						class="w-full"
					>
						{#if saving}
							<Loader2Icon class="size-4 mr-2 animate-spin" />
							{editingItemId ? 'Saving...' : 'Adding...'}
						{:else}
							<CheckIcon class="size-4 mr-2" />
							{editingItemId ? 'Save Changes' : 'Add Item'}
						{/if}
					</Button>
				</div>
			{:else if pantryView === 'receipt-review'}
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
										{PANTRY_CATEGORY_LABELS[item.category ?? 'other']}
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
		{:else if shoppingView === 'list'}
			<div class="space-y-4">
				<div class="flex gap-2">
					{#if shoppingLists.length > 0}
						<div class="relative flex-1">
							<Select type="single" bind:value={selectedListId}>
								<SelectTrigger class="w-full">
									<span class="truncate">{selectedList?.name ?? 'Select list'}</span>
								</SelectTrigger>
								<SelectContent>
									{#each shoppingLists as list (list.id)}
										<SelectItem value={list.id}>{list.name}</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</div>
					{/if}
					<Button
						variant="outline"
						size="icon"
						onclick={() => (shoppingView = 'add-list')}
						aria-label="Create new list"
					>
						<PlusIcon class="size-4" />
					</Button>
					{#if selectedList}
						<Button
							variant="outline"
							size="icon"
							onclick={() => startEditingList(selectedList)}
							aria-label="Edit list"
						>
							<PencilIcon class="size-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onclick={handleDownloadMarkdown}
							aria-label="Download list"
						>
							<DownloadIcon class="size-4" />
						</Button>
					{/if}
				</div>

				{#if !selectedList}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="rounded-full bg-muted p-4 mb-4">
							<ShoppingCartIcon class="size-8 text-muted-foreground" />
						</div>
						<p class="font-medium text-foreground">No shopping lists yet</p>
						<p class="text-sm text-muted-foreground mt-1">Create a list to start adding items</p>
						<Button variant="outline" class="mt-4" onclick={() => (shoppingView = 'add-list')}>
							<PlusIcon class="size-4 mr-2" />
							Create List
						</Button>
					</div>
				{:else}
					<div class="flex gap-2">
						<Button variant="outline" class="flex-1" onclick={() => (shoppingView = 'add-item')}>
							<PlusIcon class="size-4 mr-2" />
							Add Item
						</Button>
						<Button
							variant="outline"
							class="flex-1"
							onclick={() => shoppingScanInput?.click()}
							disabled={shoppingAnalyzing}
						>
							{#if shoppingAnalyzing}
								<Loader2Icon class="size-4 mr-2 animate-spin" />
								Scanning...
							{:else}
								<ScanIcon class="size-4 mr-2" />
								Scan
							{/if}
						</Button>
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp,image/heic,.txt,.md,text/plain,text/markdown"
							capture="environment"
							bind:this={shoppingScanInput}
							onchange={handleShoppingScan}
							class="hidden"
						/>
					</div>
					{#if selectedList.items.length === 0}
						<div class="flex flex-col items-center justify-center py-8 text-center">
							<p class="text-sm text-muted-foreground">This list is empty</p>
						</div>
					{:else}
						<div class="space-y-4 max-h-[300px] overflow-y-auto -mx-1 px-1">
							{#each PANTRY_CATEGORY_ORDER as category (category)}
								{#if groupedUncheckedItems[category]?.length}
									<div>
										<h3
											class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1"
										>
											{PANTRY_CATEGORY_LABELS[category]}
										</h3>
										<div class="rounded-lg border bg-card overflow-hidden divide-y">
											{#each groupedUncheckedItems[category] as item (item.id)}
												<div
													class="flex items-center justify-between py-2.5 px-3 hover:bg-muted/30 transition-colors group"
												>
													<div class="flex items-center gap-3 min-w-0">
														<button
															type="button"
															class="size-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors border-muted-foreground/30 hover:border-primary"
															onclick={() => handleToggleItem(item.id)}
															aria-label="Mark {item.name} as bought"
														>
														</button>
														<span class="font-medium truncate">{item.name}</span>
														{#if item.quantity && item.unit}
															<span
																class="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
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
															onclick={() => startEditingShoppingItem(item)}
														>
															<PencilIcon class="size-4" />
														</button>
														<button
															type="button"
															class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
															onclick={() => handleDeleteShoppingItem(item.id)}
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
							{#if checkedItems.length > 0}
								<div>
									<div class="flex items-center justify-between mb-2 px-1">
										<h3
											class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
										>
											Checked ({checkedItems.length})
										</h3>
										<button
											type="button"
											class="text-xs text-muted-foreground hover:text-foreground"
											onclick={handleUncheckAll}
										>
											Uncheck all
										</button>
									</div>
									<div class="rounded-lg border bg-card overflow-hidden divide-y opacity-60">
										{#each checkedItems as item (item.id)}
											<div
												class="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/30 transition-colors group"
											>
												<button
													type="button"
													class="size-5 rounded border-2 flex items-center justify-center transition-colors bg-primary border-primary text-primary-foreground"
													onclick={() => handleToggleItem(item.id)}
													aria-label="Uncheck {item.name}"
												>
													<CheckIcon class="size-3" />
												</button>
												<span class="flex-1 line-through text-muted-foreground truncate">
													{item.name}
												</span>
												<button
													type="button"
													class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors sm:opacity-0 sm:group-hover:opacity-100"
													onclick={() => handleDeleteShoppingItem(item.id)}
													aria-label="Delete {item.name}"
												>
													<TrashIcon class="size-4" />
												</button>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
						{#if checkedItems.length > 0}
							<Button onclick={handleMarkBoughtAndAddToPantry} disabled={saving} class="w-full">
								{#if saving}
									<Loader2Icon class="size-4 mr-2 animate-spin" />
									Adding to Pantry...
								{:else}
									<RefrigeratorIcon class="size-4 mr-2" />
									Add {checkedItems.length} to Pantry
								{/if}
							</Button>
						{/if}
					{/if}
				{/if}
			</div>
		{:else if shoppingView === 'add-item'}
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="shoppingItemName">Item Name</Label>
					<InputGroup>
						<InputGroupInput
							id="shoppingItemName"
							type="text"
							placeholder="e.g., Chicken Breast"
							bind:value={newName}
						/>
					</InputGroup>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="shoppingCategory">Category</Label>
						<Select type="single" bind:value={newCategory}>
							<SelectTrigger class="w-full">
								{#if newCategory}
									{PANTRY_CATEGORY_LABELS[newCategory]}
								{:else}
									<span class="text-muted-foreground">Select...</span>
								{/if}
							</SelectTrigger>
							<SelectContent>
								{#each PANTRY_CATEGORY_ORDER as cat (cat)}
									<SelectItem value={cat}>{PANTRY_CATEGORY_LABELS[cat]}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>

					<div class="space-y-2">
						<Label for="shoppingQuantity">Quantity</Label>
						<div class="flex gap-2">
							<InputGroup class="flex-1">
								<InputGroupInput
									id="shoppingQuantity"
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

				<Button
					onclick={handleSaveShoppingItem}
					disabled={!newName.trim() || saving}
					class="w-full"
				>
					{#if saving}
						<Loader2Icon class="size-4 mr-2 animate-spin" />
						{editingItemId ? 'Saving...' : 'Adding...'}
					{:else}
						<CheckIcon class="size-4 mr-2" />
						{editingItemId ? 'Save Changes' : 'Add Item'}
					{/if}
				</Button>
			</div>
		{:else if shoppingView === 'add-list' || shoppingView === 'edit-list'}
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="listName">List Name</Label>
					<InputGroup>
						<InputGroupInput
							id="listName"
							type="text"
							placeholder="e.g., Weekly Groceries"
							bind:value={newListName}
						/>
					</InputGroup>
				</div>

				<Button onclick={handleSaveList} disabled={!newListName.trim() || saving} class="w-full">
					{#if saving}
						<Loader2Icon class="size-4 mr-2 animate-spin" />
						{editingListId ? 'Saving...' : 'Creating...'}
					{:else}
						<CheckIcon class="size-4 mr-2" />
						{editingListId ? 'Save Changes' : 'Create List'}
					{/if}
				</Button>

				{#if editingListId}
					<Button
						variant="destructive"
						onclick={() => handleDeleteList(editingListId!)}
						class="w-full"
					>
						<TrashIcon class="size-4 mr-2" />
						Delete List
					</Button>
				{/if}
			</div>
		{:else if shoppingView === 'scan-review'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">
						{parsedShoppingItems.filter((i) => i.selected).length} of {parsedShoppingItems.length} selected
					</span>
					<div class="flex gap-2">
						<button
							type="button"
							class="text-xs text-primary hover:underline"
							onclick={selectAllShoppingItems}
						>
							Select all
						</button>
						<button
							type="button"
							class="text-xs text-muted-foreground hover:underline"
							onclick={deselectAllShoppingItems}
						>
							Clear
						</button>
					</div>
				</div>

				<div class="space-y-1 max-h-[350px] overflow-y-auto">
					{#each parsedShoppingItems as item, index (index)}
						<button
							type="button"
							class="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 text-left transition-colors {item.selected
								? 'bg-primary/5'
								: ''}"
							onclick={() => toggleShoppingItemSelection(index)}
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
									{PANTRY_CATEGORY_LABELS[item.category ?? 'other']}
								</div>
							</div>
						</button>
					{/each}
				</div>

				<Button
					onclick={handleAddSelectedShoppingItems}
					disabled={parsedShoppingItems.filter((i) => i.selected).length === 0 || saving}
					class="w-full"
				>
					{#if saving}
						<Loader2Icon class="size-4 mr-2 animate-spin" />
						Adding...
					{:else}
						<CheckIcon class="size-4 mr-2" />
						Add {parsedShoppingItems.filter((i) => i.selected).length} Items
					{/if}
				</Button>
			</div>
		{/if}
	</div>
</ResponsiveDialog>
