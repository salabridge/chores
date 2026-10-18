<script module lang="ts">
	export interface SetupKid {
		id: string;
		displayName: string;
		birthYear: number | null;
		weeklyGoalPoints: number;
		avatarColor: string | null;
	}
</script>

<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import ChoiceChips from '#lib/components/ui/ChoiceChips.svelte';
	import MemberAvatar from '#lib/components/ui/MemberAvatar.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import {
		AVATAR_COLORS,
		type AvatarColor,
		BIRTH_YEAR_PATTERN,
		DEFAULT_WEEKLY_GOAL,
		MAX_DISPLAY_NAME,
		MAX_KIDS,
	} from '#lib/setup.js';
	import { addKidStep, removeKidStep } from '#lib/setup.remote.js';

	let {
		kids,
		onchanged,
		oncontinue,
		onback,
	}: {
		kids: SetupKid[];
		/** A kid was added or removed. */
		onchanged?: () => void;
		oncontinue?: () => void;
		onback?: () => void;
	} = $props();

	let color = $state<string | number>('blue');
	const tone = (value: string | null): AvatarColor =>
		(AVATAR_COLORS as readonly string[]).includes(String(value))
			? (value as AvatarColor)
			: 'orange';
	const options = AVATAR_COLORS.map((value) => ({
		value,
		label: value.charAt(0).toUpperCase() + value.slice(1),
	}));
</script>

<div class="flex flex-col gap-24">
	{#if kids.length > 0}
		<ul class="flex flex-col gap-8" aria-label="Kids added so far">
			{#each kids as kid (kid.id)}
				<li
					class="flex items-center gap-12 rounded-xl border border-border-subtle bg-surface-default p-12"
				>
					<MemberAvatar name={kid.displayName} tone={tone(kid.avatarColor)} />
					<div class="min-w-0 flex-1">
						<p class="truncate font-display text-[15px] font-semibold">
							{kid.displayName}
						</p>
						<p class="text-[13px] text-text-secondary">
							{kid.weeklyGoalPoints} points a week{kid.birthYear
								? `, born ${kid.birthYear}`
								: ''}
						</p>
					</div>
					<form
						{...removeKidStep.enhance(async (form) => {
							if (await form.submit()) onchanged?.();
						})}
					>
						<input type="hidden" name="id" value={kid.id} />
						<SecondaryButton
							type="submit"
							variant="tinted"
							tone="neutral"
							aria-label={`Remove ${kid.displayName}`}
						>
							Remove
						</SecondaryButton>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	{#if kids.length < MAX_KIDS}
		<form
			{...addKidStep.enhance(async (form) => {
				if (await form.submit()) {
					form.element.reset();
					onchanged?.();
				}
			})}
			class="flex flex-col gap-16"
		>
			<FormAlert issues={addKidStep.fields.issues()} />
			<TextInput
				{...addKidStep.fields.displayName.as('text')}
				label={kids.length === 0 ? "Kid's name" : 'Another kid'}
				maxlength={MAX_DISPLAY_NAME}
				autocomplete="off"
				required
			/>
			<TextInput
				{...addKidStep.fields.birthYear.as('text')}
				label="Birth year (optional)"
				inputmode="numeric"
				pattern={BIRTH_YEAR_PATTERN}
				maxlength={4}
				placeholder="2017"
				autocomplete="off"
			/>
			<TextInput
				{...addKidStep.fields.weeklyGoalPoints.as('text')}
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
			<SecondaryButton type="submit" pending={addKidStep.pending > 0}>
				{kids.length === 0 ? 'Add kid' : 'Add another kid'}
			</SecondaryButton>
		</form>
	{/if}

	<p class="text-[13px] text-text-secondary">
		These are profiles you manage on this household's devices. Inviting a kid
		with their own login is coming soon.
	</p>

	<div class="flex flex-col gap-8">
		<PrimaryButton disabled={kids.length === 0} onclick={oncontinue}>
			Continue
		</PrimaryButton>
		{#if kids.length === 0}
			<p class="text-center text-[13px] text-text-secondary">
				Add at least one kid to continue.
			</p>
		{/if}
		{#if onback}
			<SecondaryButton onclick={onback}>Back</SecondaryButton>
		{/if}
	</div>
</div>
