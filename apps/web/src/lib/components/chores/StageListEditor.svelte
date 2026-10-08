<script lang="ts">
	import {
		addStage,
		MAX_STAGE_HINT_LENGTH,
		MAX_STAGE_TITLE_LENGTH,
		MAX_STAGES,
		moveStage,
		removeStage,
		type StageDraft,
	} from '#lib/chore-creator.js';
	import ReorderButtons from '../ui/ReorderButtons.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import TextInput from '../ui/TextInput.svelte';

	interface Props {
		/** The stages, in order. Bindable. */
		stages: StageDraft[];
		/** Problems by stage key. */
		errors?: Record<string, { title?: string; hint?: string }>;
		/** A problem with the list itself, e.g. "Add at least one stage". */
		listError?: string;
		disabled?: boolean;
	}

	let {
		stages = $bindable(),
		errors = {},
		listError,
		disabled = false,
	}: Props = $props();
</script>

<!-- Stages carry no points: the chore's points are awarded once, after the last stage. -->
<div class="flex flex-col gap-8">
	{#if stages.length > 0}
		<ol class="m-0 flex list-none flex-col gap-8 p-0" aria-label="Stages">
			{#each stages as stage, i (stage.key)}
				<li class="flex items-start gap-12 rounded-[12px] bg-surface-accent-base p-12">
					<span
						class="mt-[12px] flex size-[24px] shrink-0 items-center justify-center rounded-[12px] border border-border-subtle bg-surface-accent-orange-subtle font-display text-[11px] font-semibold text-text-orange"
						aria-hidden="true">{i + 1}</span
					>
					<div class="flex min-w-0 flex-1 flex-col gap-8">
						<TextInput
							label="Stage {i + 1} title"
							placeholder="Clear counters and scrape plates"
							maxlength={MAX_STAGE_TITLE_LENGTH}
							value={stage.title}
							oninput={(e) => (stage.title = e.currentTarget.value)}
							aria-invalid={errors[stage.key]?.title ? true : undefined}
							issues={errors[stage.key]?.title
								? [{ message: errors[stage.key]?.title as string }]
								: undefined}
							{disabled}
						/>
						<TextInput
							label="Stage {i + 1} hint (optional)"
							placeholder="Good for younger helpers before the machine starts."
							maxlength={MAX_STAGE_HINT_LENGTH}
							value={stage.hint}
							oninput={(e) => (stage.hint = e.currentTarget.value)}
							issues={errors[stage.key]?.hint
								? [{ message: errors[stage.key]?.hint as string }]
								: undefined}
							{disabled}
						/>
					</div>
					<div class="mt-[10px] flex shrink-0 items-center gap-8">
						<ReorderButtons
							name="stage {i + 1}"
							canMoveUp={i > 0}
							canMoveDown={i < stages.length - 1}
							{disabled}
							onmove={(direction) => (stages = moveStage(stages, stage.key, direction))}
						/>
						<button
							type="button"
							class="inline-flex size-[28px] items-center justify-center rounded-[8px] border border-border-subtle bg-surface-default text-text-secondary hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:cursor-not-allowed disabled:opacity-40"
							aria-label="Remove stage {i + 1}"
							{disabled}
							onclick={() => (stages = removeStage(stages, stage.key))}
						>
							<svg
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								class="size-[14px]"
								aria-hidden="true"
							>
								<path d="M4 4l8 8M12 4l-8 8" />
							</svg>
						</button>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
	{#if listError}
		<p class="text-[13px] text-text-amber" role="alert">{listError}</p>
	{/if}
	<div>
		<SecondaryButton
			disabled={disabled || stages.length >= MAX_STAGES}
			onclick={() => (stages = addStage(stages))}
		>
			Add stage
		</SecondaryButton>
	</div>
</div>
