<script lang="ts">
	import { composeStories } from '@storybook/sveltekit';
	import { type Component, mount, onDestroy, unmount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';

	let { theme }: { theme: string } = $props();

	type StoryModule = Parameters<typeof composeStories>[0] & {
		default: { title?: string };
	};
	type Composed = {
		Component: Component<Record<string, unknown>>;
		props: Record<string, unknown>;
		parameters?: { layout?: string };
	};

	// Every story file in the app except this one. New stories show up here
	// without editing this file.
	const modules = import.meta.glob<StoryModule>(
		['../../**/*.stories.svelte', '!./**'],
		{ eager: true },
	);

	// The preview's theme decorator runs again inside each composed story. Give
	// it the same theme this page is snapshotted in, or it falls back to
	// `system` and strips data-theme off <html>.
	const sections = $derived(
		Object.entries(modules)
			.map(([path, module]) => ({
				title: module.default.title ?? path,
				stories: (
					Object.entries(
						composeStories(module, { initialGlobals: { theme } }),
					) as [string, Composed][]
				).map(([exportName, story]) => ({
					name: storyName(module, exportName),
					fullscreen: story.parameters?.layout === 'fullscreen',
					story,
				})),
			}))
			.sort((a, b) => a.title.localeCompare(b.title)),
	);

	// The display name ("Locked (password unlock)"), not the export name.
	function storyName(module: StoryModule, exportName: string) {
		const story = (module as unknown as Record<string, { name?: unknown }>)[
			exportName
		];
		return typeof story?.name === 'string' ? story.name : exportName;
	}

	// Svelte CSF keeps "which story to render" in a Svelte context and reuses
	// one it finds. Rendered as a child of this story, every nested story would
	// overwrite this story's context and blank the page, so each one is mounted
	// as its own root with an empty context.
	function render(story: Composed): Attachment<HTMLElement> {
		return (target) => {
			try {
				const app = mount(story.Component, {
					target,
					props: story.props,
					context: new Map(),
				});
				return () => unmount(app);
			} catch (error) {
				target.dataset.visualTestFailed = '';
				target.textContent = error instanceof Error ? error.message : String(error);
			}
		};
	}

	// Modal dialogs render in the top layer, over the whole page, and stack on
	// top of each other. Open them in place instead while this page is mounted.
	const showModal = HTMLDialogElement.prototype.showModal;
	HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.show;
	onDestroy(() => {
		HTMLDialogElement.prototype.showModal = showModal;
	});
</script>

<div class="visual-test flex flex-col gap-48 text-text-primary">
	{#each sections as section (section.title)}
		<section class="flex flex-col gap-16">
			<h2 class="font-display text-[20px] font-bold">{section.title}</h2>
			<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-16">
				{#each section.stories as { name, fullscreen, story } (name)}
					<figure class={['flex flex-col gap-8', fullscreen && 'col-span-full']}>
						<figcaption class="text-[12px] font-semibold text-text-secondary">
							{name}
						</figcaption>
						<!-- `transform` makes this the containing block for fixed and
						     sticky children, so app-shell pieces stay in their frame. -->
						<div
							class={[
								'relative min-h-[64px] transform-gpu overflow-hidden rounded-xl border border-border-subtle',
								!fullscreen && 'p-16',
							]}
							{@attach render(story)}
						></div>
					</figure>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	/* Freeze animations and transitions so snapshots are stable. These have
	   to beat the components' own utility classes, hence !important. */
	/* biome-ignore-start lint/complexity/noImportantStyles: see above */
	.visual-test :global(*),
	.visual-test :global(*::before),
	.visual-test :global(*::after) {
		animation: none !important;
		transition: none !important;
		caret-color: transparent !important;
	}
	/* biome-ignore-end lint/complexity/noImportantStyles: see above */

	/* Non-modal dialogs are absolutely positioned and would be clipped by
	   their frame. Keep them in the flow so the frame grows to fit. */
	.visual-test :global(dialog[open]) {
		position: static;
	}
</style>
