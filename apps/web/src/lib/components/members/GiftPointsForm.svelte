<script lang="ts">
	import { track } from '#lib/analytics.js';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { withoutValue } from '#lib/form-field.js';
	import {
		MAX_GIFT_POINTS,
		MAX_GIFT_REASON,
		QUICK_GIFT_AMOUNTS,
	} from '#lib/gift.js';
	import type { HouseholdMember } from '#lib/members.js';
	import { giftPoints } from '#lib/members.remote.js';

	let {
		member,
		onsaved,
		oncancel,
	}: {
		/** The kid getting the points. */
		member: Pick<HouseholdMember, 'id' | 'displayName'>;
		/** The points were given; `points` is the amount. */
		onsaved?: (points: number) => void;
		oncancel?: () => void;
	} = $props();

	const form = $derived(giftPoints.for(member.id));
	let points = $state('');
	let reason = $state('');
</script>

<form
	{...form.enhance(async (f) => {
		const given = Number(points);
		if (await f.submit()) {
			track('bonus_points_gifted', { points: given });
			onsaved?.(given);
		}
	})}
	class="flex flex-col gap-12"
	aria-label={`Give ${member.displayName} bonus points`}
>
	<input type="hidden" name="memberId" value={member.id} />
	<FormAlert issues={form.fields.issues()} />
	<fieldset class="m-0 flex min-w-0 flex-col gap-8 border-0 p-0">
		<legend class="mb-8 p-0 text-[14px] font-semibold text-text-secondary">
			Quick amounts
		</legend>
		<div class="flex flex-wrap gap-8">
			{#each QUICK_GIFT_AMOUNTS as amount (amount)}
				{@const selected = points === String(amount)}
				<button
					type="button"
					aria-pressed={selected}
					onclick={() => (points = String(amount))}
					class={[
						'cursor-pointer rounded-[10px] px-12 py-8 font-display text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange',
						selected
							? 'border-2 border-border-orange bg-surface-accent-orange-subtle px-[11px] py-[7px] text-text-orange'
							: 'border border-border-subtle bg-surface-default text-text-secondary',
					]}
				>
					+{amount}
				</button>
			{/each}
		</div>
	</fieldset>
	<TextInput
		{...withoutValue(form.fields.points.as('text'))}
		label="Points"
		hint={`A whole number from 1 to ${MAX_GIFT_POINTS}.`}
		value={points}
		oninput={(e) => (points = e.currentTarget.value)}
		inputmode="numeric"
		pattern="[0-9]*"
		maxlength={3}
		autocomplete="off"
		required
	/>
	<TextInput
		{...withoutValue(form.fields.reason.as('text'))}
		label="Reason"
		hint="Shown to the kid with the points, e.g. Helped Grandma with groceries."
		value={reason}
		oninput={(e) => (reason = e.currentTarget.value)}
		maxlength={MAX_GIFT_REASON}
		autocomplete="off"
		required
	/>
	<div class="flex gap-8">
		<PrimaryButton type="submit" pending={form.pending > 0}>
			Give points
		</PrimaryButton>
		<SecondaryButton type="button" variant="tinted" tone="neutral" onclick={oncancel}>
			Cancel
		</SecondaryButton>
	</div>
</form>
