<script lang="ts">
	import { type NoteTone, type OverviewNote, plural } from '#lib/overview.js';
	import Badge from '../ui/Badge.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	let { notes }: { notes: OverviewNote[] } = $props();

	const rules = $derived(notes.filter((n) => n.kind === 'exclusion').length);

	const tones: Record<NoteTone, string> = {
		warning: 'bg-surface-accent-amber-subtle text-text-amber',
		info: 'bg-surface-accent-blue-subtle text-text-blue',
		success: 'bg-surface-accent-green-subtle text-text-green',
	};
</script>

<SurfaceCard
	title="Exceptions & Notes"
	subtitle="Rules and edge cases that affect the next loop cycle."
	data-testid="exceptions-notes"
>
	{#snippet badge()}
		<Badge tone="this-week">{plural(rules, 'active rule')}</Badge>
	{/snippet}
	{#if notes.length === 0}
		<p class="text-[13px] text-text-secondary">
			Nothing to flag. No exclusion rules are active.
		</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-12 p-0">
			{#each notes as note (note.text)}
				<li
					data-tone={note.tone}
					class={['flex items-start gap-8 rounded-[12px] p-12', tones[note.tone]]}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="mt-2 size-[16px] shrink-0"
						aria-hidden="true"
					>
						{#if note.tone === 'warning'}
							<path
								d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
							/>
							<path d="M12 8v4" />
							<path d="M12 16h.01" />
						{:else if note.tone === 'info'}
							<path
								d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
							/>
						{:else}
							<circle cx="12" cy="12" r="4" />
							<path
								d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
							/>
						{/if}
					</svg>
					<p class="min-w-0 flex-1 text-[13px]">{note.text}</p>
				</li>
			{/each}
		</ul>
	{/if}
</SurfaceCard>
