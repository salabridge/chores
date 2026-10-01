<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type StageState = 'completed' | 'current' | 'locked';

	type BaseProps = Omit<HTMLAttributes<HTMLLIElement>, 'children' | 'title'> & {
		title: string;
	};

	type ChecklistProps = BaseProps & {
		variant?: 'checklist';
		state: StageState;
		/** Overrides the default status line for the state. */
		status?: string;
	};

	type EditorProps = BaseProps & {
		variant: 'editor';
		/** 1-based position shown in the number circle. */
		number: number;
		hint?: string;
		points: number;
	};

	type Props = ChecklistProps | EditorProps;

	const defaultStatus: Record<StageState, string> = {
		completed: 'Completed',
		current: 'Current stage',
		locked: 'Remaining after this stage',
	};

	let props: Props = $props();

	const checklist = $derived(props.variant === 'editor' ? undefined : props);
	const editor = $derived(props.variant === 'editor' ? props : undefined);
</script>

{#if editor}
	{@const { variant: _v, number, title, hint, points, class: className, ...rest } = editor}
	<li
		{...rest}
		class={[
			'flex items-center gap-12 rounded-[12px] bg-surface-accent-base p-12',
			className,
		]}
	>
		<span
			class="flex size-[24px] shrink-0 items-center justify-center rounded-[12px] border border-border-subtle bg-surface-accent-orange-subtle font-display text-[11px] font-semibold text-text-orange"
			aria-hidden="true">{number}</span
		>
		<span class="flex min-w-0 flex-1 flex-col gap-2">
			<span class="font-display text-[14px] font-semibold text-text-primary"
				>{title}</span
			>
			{#if hint}
				<span class="text-[11px] text-text-secondary">{hint}</span>
			{/if}
		</span>
		<span
			class="shrink-0 rounded-[8px] bg-surface-default px-8 py-4 text-[11px] font-semibold whitespace-nowrap text-text-secondary"
			>{points} pts</span
		>
	</li>
{:else if checklist}
	{@const { variant: _v, state: stage, title, status: statusText, class: className, ...rest } = checklist}
	<li
		{...rest}
		aria-current={stage === 'current' ? 'step' : undefined}
		data-state={stage}
		class={[
			'flex items-center gap-16 rounded-[16px] p-16',
			stage === 'completed' &&
				'border border-border-green bg-surface-accent-green-subtle',
			stage === 'current' && 'border-2 border-border-amber bg-surface-default',
			stage === 'locked' &&
				'border border-border-subtle bg-surface-default opacity-60',
			className,
		]}
	>
		<span
			class={[
				'flex size-[26px] shrink-0 items-center justify-center rounded-full',
				stage === 'completed' && 'bg-accent-green',
				stage === 'current' && 'border-2 border-border-amber',
				stage === 'locked' && 'border border-border-muted',
			]}
			aria-hidden="true"
		>
			{#if stage === 'completed'}
				<svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
					<path
						d="M8.333 2.5L3.75 7.083L1.667 5"
						stroke="white"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{/if}
		</span>
		<span
			class={[
				'flex min-w-0 flex-1 flex-col gap-2',
				stage === 'completed' && 'text-text-green',
				stage === 'locked' && 'text-text-muted',
			]}
		>
			<span
				class={[
					'font-display text-[14px] font-semibold',
					stage === 'current' && 'text-text-primary',
				]}>{title}</span
			>
			<span
				class={['text-[12px]', stage === 'current' && 'text-text-amber']}
				>{statusText ?? defaultStatus[stage]}</span
			>
		</span>
	</li>
{/if}
