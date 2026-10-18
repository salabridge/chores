<script lang="ts">
	import AddManagedKidForm from '#lib/components/members/AddManagedKidForm.svelte';
	import MemberList from '#lib/components/members/MemberList.svelte';
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
	subtitle="Everyone in your household. Add a kid profile you manage on this household's devices."
/>

<div class="grid items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
	<SurfaceCard title="Household" subtitle={plural(data.members.length, 'member')}>
		<MemberList members={data.members} />
	</SurfaceCard>
	<SurfaceCard title="Add a kid">
		<AddManagedKidForm {kidCount} />
	</SurfaceCard>
</div>
