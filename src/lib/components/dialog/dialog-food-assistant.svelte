<script lang="ts">
	import { Markdown } from '$lib/components/markdown';
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupButton,
		InputGroupText,
		InputGroupTextarea
	} from '$lib/components/ui/input-group';
	import type { Message, MessagePart } from '$lib/messages';
	import { deleteUploadedImage, getImageUploadUrl } from '$lib/remote/meals.remote';
	import type { AssistantContext } from '$lib/server/assistant';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChefHatIcon from '@lucide/svelte/icons/chef-hat';
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import XIcon from '@lucide/svelte/icons/x';
	import { DefaultChatTransport, readUIMessageStream } from 'ai';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import DialogFoodAssistantCard from './dialog-food-assistant-card.svelte';
	import ResponsiveDialog from './dialog-responsive.svelte';

	class StreamParser extends DefaultChatTransport<Message> {
		public parseStream(stream: ReadableStream<Uint8Array>) {
			return this.processResponseStream(stream);
		}
	}

	type MealData = {
		name: string;
		calories: number;
		servings?: number;
		protein?: number;
		carbs?: number;
		fat?: number;
	};

	let {
		open = $bindable(false),
		context,
		onLogMeal
	}: {
		open?: boolean;
		context: AssistantContext;
		onLogMeal?: (meal: MealData) => void;
	} = $props();

	let imagePreview = $state<string | null>(null);
	let imageData = $state<{ imageKey: string; downloadUrl: string; mimeType: string } | null>(null);
	let currentImageKey = $state<string | null>(null);
	let uploadedImageKeys = $state<string[]>([]);
	let fileInput = $state<HTMLInputElement | null>(null);
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let input = $state('');
	let messages = $state<Message[]>([]);
	let isStreaming = $state(false);

	const remainingCalories = $derived(Math.max(0, context.calorieGoal - context.caloriesConsumed));

	function reset() {
		for (const key of uploadedImageKeys) {
			deleteUploadedImage({ imageKey: key }).catch(() => {});
		}
		if (currentImageKey && !uploadedImageKeys.includes(currentImageKey)) {
			deleteUploadedImage({ imageKey: currentImageKey }).catch(() => {});
		}
		imagePreview = null;
		imageData = null;
		currentImageKey = null;
		uploadedImageKeys = [];
		input = '';
		messages = [];
		isStreaming = false;
	}

	$effect(() => {
		if (!open) {
			setTimeout(reset, 300);
		}
	});

	$effect(() => {
		if (messages.length > 0 && messagesContainer) {
			tick().then(() => {
				messagesContainer?.scrollTo({
					top: messagesContainer.scrollHeight,
					behavior: 'smooth'
				});
			});
		}
	});

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || !target.files[0]) return;

		const file = target.files[0];
		imagePreview = URL.createObjectURL(file);

		try {
			const mimeType = file.type || 'image/jpeg';
			const { imageKey, uploadUrl, downloadUrl } = await getImageUploadUrl({ mimeType });
			const res = await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: { 'Content-Type': mimeType }
			});

			if (!res.ok) throw new Error('Upload failed');

			currentImageKey = imageKey;
			imageData = { imageKey, downloadUrl, mimeType };
		} catch (err) {
			console.error('Image upload failed:', err);
			toast.error('Failed to upload image');
			imagePreview = null;
		}
	}

	function clearImage() {
		if (currentImageKey) {
			deleteUploadedImage({ imageKey: currentImageKey }).catch(() => {});
		}
		imagePreview = null;
		imageData = null;
		currentImageKey = null;
		if (fileInput) fileInput.value = '';
	}

	async function handleSend(e?: Event) {
		e?.preventDefault();
		if (!input.trim() && !imageData) return;
		if (isStreaming) return;

		const userText = input.trim();
		const currentImageData = imageData;
		const userParts: MessagePart[] = [];

		if (currentImageData) {
			userParts.push({
				type: 'file',
				url: currentImageData.downloadUrl,
				mediaType: currentImageData.mimeType
			});
		}
		if (userText) {
			userParts.push({ type: 'text', text: userText });
		}

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			parts: userParts
		};
		messages = [...messages, userMessage];

		input = '';
		isStreaming = true;

		if (imageData) {
			if (currentImageKey) {
				uploadedImageKeys = [...uploadedImageKeys, currentImageKey];
			}
			imageData = null;
			imagePreview = null;
			currentImageKey = null;
		}

		try {
			const response = await fetch('/api/assistant', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages, context })
			});

			if (!response.ok) {
				throw new Error(`Failed to get response: ${response.statusText}`);
			}

			if (!response.body) {
				throw new Error('Response body is null');
			}

			const parser = new StreamParser();
			const chunkStream = parser.parseStream(response.body);

			try {
				for await (const message of readUIMessageStream<Message>({
					stream: chunkStream,
					terminateOnError: true,
					onError: (error) => console.error('Stream parse error:', error)
				})) {
					const idx = messages.findIndex((m) => m.id === message.id);
					if (idx === -1) {
						messages = [...messages, message];
					} else {
						messages[idx] = message;
						messages = [...messages];
					}
				}
			} catch (streamErr) {
				if (!(streamErr instanceof TypeError && String(streamErr).includes('cancel'))) {
					throw streamErr;
				}
			}
		} catch (err) {
			console.error('Chat error:', err);
			toast.error('Something went wrong. Please try again.');
		} finally {
			isStreaming = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function sendQuickAction(text: string) {
		input = text;
		handleSend();
	}

	function getMessageText(msg: Message): string {
		if (!msg.parts) return '';
		return (
			msg.parts
				.filter((p) => p.type === 'text')
				.map((p) => p.text)
				.join('\n') || ''
		);
	}

	function hasRenderableContent(msg: Message): boolean {
		return (
			msg.parts?.some((p) => (p.type === 'text' && p.text) || p.type === 'tool-suggestFood') ??
			false
		);
	}

	const quickActions = [
		{
			icon: MenuIcon,
			label: 'Analyze menu',
			prompt: "Here's a menu - what should I order that fits my calorie budget?"
		},
		{
			icon: ChefHatIcon,
			label: 'What can I cook?',
			prompt: "Here's what I have - what can I make?"
		},
		{
			icon: UtensilsIcon,
			label: 'Suggest a meal',
			prompt: 'What should I eat right now that fits my remaining calories?'
		}
	];
</script>

<ResponsiveDialog
	bind:open
	title="Food Assistant"
	subtitle="Get personalized meal suggestions"
	contentClass="sm:max-w-lg h-[80vh] sm:h-[600px] flex flex-col overflow-hidden"
	onBack={messages.length > 0 ? reset : undefined}
>
	<div class="flex flex-col flex-1 min-h-0">
		<div class="flex flex-1 flex-col overflow-hidden">
			<div
				bind:this={messagesContainer}
				class="flex-1 space-y-4 overflow-y-auto"
				style="scrollbar-width: thin;"
			>
				{#if messages.length === 0 && !isStreaming}
					<div class="flex flex-col h-full">
						<div class="py-4 text-center">
							<p class="font-medium mb-1">What would you like help with?</p>
							<p class="text-sm text-muted-foreground">
								Upload a photo or ask me anything about food
							</p>
						</div>
						<div class="w-full space-y-2">
							{#each quickActions as action (action.label)}
								<button
									type="button"
									class="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-muted/50"
									onclick={() => {
										if (action.label === 'Suggest a meal') {
											sendQuickAction(action.prompt);
										} else {
											fileInput?.click();
											input = action.prompt;
										}
									}}
								>
									<div class="rounded-lg p-2 bg-muted">
										<action.icon class="size-4 text-muted-foreground" />
									</div>
									<span class="text-sm font-medium">{action.label}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#each messages as message (message.id)}
					<div class={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
						{#if message.role === 'user'}
							<div class="max-w-[85%] space-y-2">
								{#each message.parts?.filter((p) => p.type === 'file') || [] as filePart, i (i)}
									<div class="flex justify-end">
										<div class="w-32 h-32 rounded-xl overflow-hidden border">
											<img src={filePart.url} alt="Uploaded" class="w-full h-full object-cover" />
										</div>
									</div>
								{/each}
								{#if getMessageText(message)}
									<div
										class="rounded-2xl rounded-br-md bg-primary px-4 py-2 text-primary-foreground shadow-xs"
									>
										<p class="whitespace-pre-wrap text-sm">{getMessageText(message)}</p>
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex gap-2 max-w-[85%]">
								<div
									class="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center mt-1"
								>
									<SparklesIcon class="size-4 text-muted-foreground" />
								</div>
								<div class="flex flex-col gap-2 min-w-0">
									<div class="rounded-2xl rounded-tl-md bg-muted/50 px-4 py-3 shadow-sm">
										{#if hasRenderableContent(message)}
											{#each message.parts as part, i (i)}
												{#if part.type === 'text' && part.text}
													<Markdown source={part.text} class="text-sm leading-relaxed" />
												{:else if part.type === 'tool-suggestFood' && part.state === 'input-available'}
													<DialogFoodAssistantCard
														name={part.input.name}
														calories={part.input.calories}
														protein={part.input.protein}
														carbs={part.input.carbs}
														fat={part.input.fat}
														onLog={() => onLogMeal?.(part.input as MealData)}
													/>
												{/if}
											{/each}
										{:else}
											<div class="flex items-center gap-2">
												<Loader2Icon class="size-4 animate-spin text-muted-foreground" />
												<span class="text-sm text-muted-foreground">Thinking...</span>
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			<div class="shrink-0 pt-3">
				<input
					type="file"
					accept="image/jpeg,image/png,image/webp"
					capture="environment"
					bind:this={fileInput}
					onchange={handleFileSelect}
					class="hidden"
				/>
				<form onsubmit={handleSend}>
					<InputGroup>
						<InputGroupTextarea
							bind:value={input}
							placeholder="Ask about food, menus, or what to cook..."
							class="min-h-[44px] max-h-[100px] resize-none"
							rows={1}
							onkeydown={handleKeydown}
							disabled={isStreaming}
						/>
						<InputGroupAddon align="block-end">
							{#if imagePreview}
								<div class="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border">
									<img src={imagePreview} alt="Attached" class="h-full w-full object-cover" />
									<button
										type="button"
										class="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
										onclick={clearImage}
									>
										<XIcon class="size-3" />
									</button>
								</div>
							{:else}
								<InputGroupButton
									type="button"
									variant="outline"
									class="rounded-full"
									size="icon-xs"
									onclick={() => fileInput?.click()}
									disabled={isStreaming}
								>
									<ImagePlusIcon class="size-4" />
								</InputGroupButton>
							{/if}
							<InputGroupText class="ms-auto text-xs">
								{remainingCalories.toLocaleString()} kcal left
							</InputGroupText>
							<InputGroupButton
								type="submit"
								variant="default"
								class="rounded-full"
								size="icon-xs"
								disabled={(!input.trim() && !imageData) || isStreaming}
							>
								{#if isStreaming}
									<Loader2Icon class="size-4 animate-spin" />
								{:else}
									<ArrowUpIcon class="size-4" />
								{/if}
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</form>
			</div>
		</div>
	</div>
</ResponsiveDialog>
