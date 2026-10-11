<script lang="ts">
	import { composeStories } from '@storybook/sveltekit';
	import { type Component, mount, onDestroy, unmount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { VISUAL_TEST_TAG } from './config.js';

	type StoryModule = Parameters<typeof composeStories>[0];
	type Composed = {
		Component: Component<Record<string, unknown>>;
		props: Record<string, unknown>;
		parameters?: { layout?: string };
		tags?: string[];
	};

	let {
		stories,
		theme,
	}: {
		/**
		 * The stories file's own module (`import * as thisFile from
		 * './X.stories.svelte'`). svelte-check types that import as a plain
		 * component rather than the CSF exports Svelte CSF compiles it to, hence
		 * the loose type.
		 */
		stories: Record<string, unknown>;
		/** The theme this snapshot is taken in, from the story's globals. */
		theme: string;
	} = $props();

	const order = $derived(
		(stories.__namedExportsOrder ?? []) as string[],
	);

	// The preview's theme decorator runs again inside each composed story. Give
	// it the same theme this story is snapshotted in, or it falls back to
	// `system` and strips data-theme off <html>.
	const states = $derived(
		(
			Object.entries(
				composeStories(stories as StoryModule, { initialGlobals: { theme } }),
			) as [string, Composed][]
		)
			.filter(([, story]) => !story.tags?.includes(VISUAL_TEST_TAG))
			// Same order as the file (module namespaces are alphabetical).
			.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
			.map(([exportName, story]) => ({
				name: storyName(exportName),
				fullscreen: story.parameters?.layout === 'fullscreen',
				story,
			})),
	);

	// The display name ("Locked (password unlock)"), not the export name.
	function storyName(exportName: string) {
		const story = stories[exportName] as { name?: unknown } | undefined;
		return typeof story?.name === 'string' ? story.name : exportName;
	}

	// Svelte CSF keeps "which story to render" in a Svelte context and reuses
	// one it finds. Rendered as a child of the visual-test story, every nested
	// story would overwrite that story's context and blank the canvas, so each
	// one is mounted as its own root with an empty context.
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

	// Modal dialogs render in the top layer, over the whole canvas, and stack on
	// top of each other. Open them in place instead while this grid is mounted.
	const showModal = HTMLDialogElement.prototype.showModal;
	HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.show;
	onDestroy(() => {
		HTMLDialogElement.prototype.showModal = showModal;
	});
</script>

<div
	class="visual-test grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-16 text-text-primary"
>
	{#each states as { name, fullscreen, story } (name)}
		<figure class={['flex flex-col gap-8', fullscreen && 'col-span-full']}>
			<figcaption class="text-[12px] font-semibold text-text-secondary">
				{name}
			</figcaption>
			<!-- `transform` makes this the containing block for fixed and sticky
			     children, so app-shell pieces stay in their frame. -->
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
