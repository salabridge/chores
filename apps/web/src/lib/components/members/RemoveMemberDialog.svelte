<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';
	import type { HouseholdMember } from '#lib/members.js';
	import { removeMember } from '#lib/members.remote.js';

	let {
		open = $bindable(false),
		member,
		moveTargets = [],
		onremoved,
	}: {
		open?: boolean;
		/** Who is being removed. */
		member: Pick<HouseholdMember, 'id' | 'displayName' | 'role' | 'managed'>;
		/**
		 * The kids their points can move to (`pointsMoveTargets()`). Empty hides
		 * the choice, e.g. for a parent.
		 */
		moveTargets?: Pick<HouseholdMember, 'id' | 'displayName'>[];
		/** They were removed; `movedTo` is the kid who got their points, if any. */
		onremoved?: (movedTo: string | null) => void;
	} = $props();

	const form = $derived(removeMember.for(member.id));
	let dialog: HTMLDialogElement | undefined = $state();
	let movePointsTo = $state('');
	const selectId = $props.id();
	const titleId = `${selectId}-title`;

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	class="m-auto w-[min(420px,calc(100vw-32px))] rounded-[16px] border border-border-subtle bg-surface-default p-24 text-text-primary backdrop:bg-black/50"
>
	<form
		{...form.enhance(async (f) => {
			const movedTo =
				moveTargets.find((k) => k.id === movePointsTo)?.displayName ?? null;
			if (await f.submit()) {
				open = false;
				onremoved?.(movedTo);
			}
		})}
		class="flex flex-col gap-16"
	>
		<input type="hidden" name="memberId" value={member.id} />
		<div class="flex flex-col gap-4">
			<h2 id={titleId} class="font-display text-[20px] font-bold">
				Remove {member.displayName}?
			</h2>
			<p class="text-[14px] text-text-secondary">
				{member.displayName} leaves the household and disappears from your member
				list.
			</p>
		</div>

		<ul class="flex list-disc flex-col gap-6 pl-20 text-[14px] text-text-secondary">
			<li>
				Their chores from today on are unassigned, and rotations hand their turn to
				the next person.
			</li>
			<li>
				Their history is kept: past chores, "Done by" and the points log stay as
				they were.
			</li>
			<li>Reminders and favours waiting on them are cancelled.</li>
			{#if !member.managed}
				<li>
					They keep their account, but lose access to this household straight
					away.
				</li>
			{/if}
		</ul>

		{#if moveTargets.length > 0}
			<div class="flex flex-col gap-6">
				<label for={selectId} class="text-[13px] font-semibold text-text-secondary">
					Move their points to…
				</label>
				<select
					id={selectId}
					name="movePointsTo"
					bind:value={movePointsTo}
					class="h-[48px] w-full rounded-xl border border-border-orange bg-surface-default px-16 text-[15px] text-text-primary focus-visible:outline-2 focus-visible:outline-border-orange"
				>
					<option value="">Don't move them</option>
					{#each moveTargets as kid (kid.id)}
						<option value={kid.id}>{kid.displayName}</option>
					{/each}
				</select>
				<p class="text-[13px] text-text-secondary">
					For a duplicate profile: their whole points balance moves to the kid you
					pick.
				</p>
			</div>
		{/if}

		<FormAlert issues={form.fields.issues()} />

		<div class="flex flex-wrap gap-8">
			<SecondaryButton
				type="submit"
				variant="tinted"
				tone="red"
				pending={form.pending > 0}
			>
				Remove {member.displayName}
			</SecondaryButton>
			<SecondaryButton
				type="button"
				variant="tinted"
				tone="neutral"
				onclick={() => (open = false)}
			>
				Cancel
			</SecondaryButton>
		</div>
	</form>
</dialog>
