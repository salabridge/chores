<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import ChoiceChips from '#lib/components/ui/ChoiceChips.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { addManagedKidMember } from '#lib/members.remote.js';
	import {
		AVATAR_COLORS,
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

	let color = $state<string | number>('blue');
	const options = AVATAR_COLORS.map((value) => ({
		value,
		label: value.charAt(0).toUpperCase() + value.slice(1),
	}));
</script>

{#if kidCount >= MAX_KIDS}
	<p class="text-[14px] text-text-secondary">
		A household can have up to {MAX_KIDS} kids.
	</p>
{:else}
	<form
		{...addManagedKidMember.enhance(async (form) => {
			if (await form.submit()) {
				form.element.reset();
				onadded?.();
			}
		})}
		class="flex flex-col gap-16"
	>
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
			pattern="[0-9]{4}"
			maxlength={4}
			placeholder="2017"
			autocomplete="off"
		/>
		<TextInput
			{...addManagedKidMember.fields.weeklyGoalPoints.as('text')}
			label="Weekly points goal"
			inputmode="numeric"
			pattern="[0-9]*"
			value={String(DEFAULT_WEEKLY_GOAL)}
			autocomplete="off"
		/>
		<div class="flex flex-col gap-8">
			<span class="text-[14px] font-semibold text-text-secondary">
				Avatar colour
			</span>
			<ChoiceChips
				label="Avatar colour"
				name="avatarColor"
				{options}
				bind:value={color}
			/>
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
