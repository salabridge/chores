<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import AvatarColorPicker from '#lib/components/ui/AvatarColorPicker.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { withoutValue } from '#lib/form-field.js';
	import { addManagedKidMember } from '#lib/members.remote.js';
	import {
		BIRTH_YEAR_PATTERN,
		DEFAULT_WEEKLY_GOAL,
		MAX_DISPLAY_NAME,
		MAX_KIDS,
	} from '#lib/setup.js';

	let {
		kidCount,
		onadded,
	}: {
		/** Kids already in the household, to show when the cap is reached. */
		kidCount: number;
		/** A kid was added. */
		onadded?: () => void;
	} = $props();

	const DEFAULT_COLOR = 'blue';
	let color = $state(DEFAULT_COLOR);
	/** The name of the kid just added, for the confirmation. */
	let added = $state<string | null>(null);
</script>

{#if kidCount >= MAX_KIDS}
	<p class="text-[14px] text-text-secondary">
		A household can have up to {MAX_KIDS} kids.
	</p>
{:else}
	<form
		{...addManagedKidMember.enhance(async (form) => {
			const name = String(
				new FormData(form.element).get('displayName') ?? '',
			);
			added = null;
			// A successful submit already invalidates the page's data.
			if (await form.submit()) {
				// reset() puts the radios back to their SSR default, so the chips'
				// state has to follow or the highlighted colour isn't the one sent.
				form.element.reset();
				color = DEFAULT_COLOR;
				added = name;
				onadded?.();
			}
		})}
		class="flex flex-col gap-16"
	>
		{#if added}
			<p role="status" class="text-[13px] text-text-green">Added {added}.</p>
		{/if}
		<FormAlert issues={addManagedKidMember.fields.issues()} />
		<TextInput
			{...addManagedKidMember.fields.displayName.as('text')}
			label="Kid's name"
			maxlength={MAX_DISPLAY_NAME}
			autocomplete="off"
			required
		/>
		<TextInput
			{...addManagedKidMember.fields.birthYear.as('text')}
			label="Birth year (optional)"
			inputmode="numeric"
			pattern={BIRTH_YEAR_PATTERN}
			maxlength={4}
			placeholder="2017"
			autocomplete="off"
		/>
		<TextInput
			{...withoutValue(addManagedKidMember.fields.weeklyGoalPoints.as('text'))}
			label="Weekly points goal"
			inputmode="numeric"
			pattern="[0-9]*"
			value={addManagedKidMember.fields.weeklyGoalPoints.value() ||
				String(DEFAULT_WEEKLY_GOAL)}
			autocomplete="off"
		/>
		<div class="flex flex-col gap-8">
			<span class="text-[14px] font-semibold text-text-secondary">
				Avatar colour
			</span>
			<AvatarColorPicker name="avatarColor" bind:value={color} />
		</div>
		<p class="text-[13px] text-text-secondary">
			A managed kid has no login. You switch into their profile on this
			household's devices, and the parent PIN switches back.
		</p>
		<PrimaryButton type="submit" pending={addManagedKidMember.pending > 0}>
			Add kid
		</PrimaryButton>
	</form>
{/if}
