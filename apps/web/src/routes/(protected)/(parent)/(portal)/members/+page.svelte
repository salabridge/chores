<script lang="ts">
	import AddManagedKidForm from '#lib/components/members/AddManagedKidForm.svelte';
	import InviteMemberForm from '#lib/components/members/InviteMemberForm.svelte';
	import MemberList from '#lib/components/members/MemberList.svelte';
	import PendingInvites from '#lib/components/members/PendingInvites.svelte';
	import WorkspaceHeader from '#lib/components/shell/WorkspaceHeader.svelte';
	import SurfaceCard from '#lib/components/ui/SurfaceCard.svelte';
	import { plural } from '#lib/overview.js';

	let { data } = $props();

	const kidCount = $derived(
		data.members.filter((m) => m.role === 'kid').length,
	);
</script>

<WorkspaceHeader
	title="Members"
	subtitle="Everyone in your household. Invite a co-parent or a kid with their own login, or add a kid profile you manage."
/>

<div class="grid items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
	<div class="flex min-w-0 flex-col gap-24">
		<SurfaceCard title="Household" subtitle={plural(data.members.length, 'member')}>
			<MemberList members={data.members} />
		</SurfaceCard>
		<SurfaceCard title="Pending invites">
			<PendingInvites invites={data.invites} actorRole={data.actorRole} />
		</SurfaceCard>
	</div>
	<div class="flex min-w-0 flex-col gap-24">
		<SurfaceCard title="Invite someone">
			<InviteMemberForm canInviteParent={data.actorRole === 'owner'} />
		</SurfaceCard>
		<SurfaceCard title="Add a kid you manage">
			<AddManagedKidForm {kidCount} />
		</SurfaceCard>
	</div>
</div>
