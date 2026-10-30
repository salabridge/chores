<script lang="ts">
	import LegalPage from '#lib/components/legal/LegalPage.svelte';

	const title = 'Privacy Policy · ChoreLoop';
	const description =
		'What ChoreLoop collects, who processes it, and the choices families have, including for children.';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
</svelte:head>

<!-- DRAFT (SB-94): the wording needs legal review before launch. The facts
     come from the codebase; see "Analytics (PostHog)" in apps/web/README.md
     and keep the processor list below in step with production. -->
<LegalPage title="Privacy Policy" lastUpdated="30 October 2026">
	<p>
		ChoreLoop helps families share chores, take turns and earn points. This
		policy explains what we collect, why, who handles it for us, and what
		choices you have. It covers parents, teens who sign in themselves, and
		the children whose profiles a parent creates.
	</p>

	<h2>Who uses ChoreLoop</h2>
	<ul>
		<li>
			<strong>Parents and owners</strong> create a household and manage it.
		</li>
		<li>
			<strong>Invited parents</strong> join an existing household.
		</li>
		<li>
			<strong>Invited kids aged 13 and over</strong> can have their own login.
		</li>
		<li>
			<strong>Managed kid profiles</strong> have no login. A parent creates
			and controls them, and they are used on a parent's device.
		</li>
	</ul>

	<h2>What we collect</h2>
	<ul>
		<li>
			<strong>Account details:</strong> email address, display name and a
			hashed password (never the password itself).
		</li>
		<li>
			<strong>Household details:</strong> the household and its members,
			including each member's display name and avatar colour.
		</li>
		<li>
			<strong>Activity:</strong> chores, completions, favours, points,
			rewards and reward claims.
		</li>
		<li>
			<strong>Invitations:</strong> the email address of anyone a parent
			invites.
		</li>
		<li>
			<strong>Usage data</strong> from analytics and error tracking, described
			below.
		</li>
	</ul>

	<h2>Children's privacy</h2>
	<p>
		A parent or guardian creates a managed profile for a child under 13 and
		gives consent on the child's behalf by doing so. For a managed profile we
		hold only a display name, an avatar colour and the chores and points
		activity in the household. We don't ask a child for an email address, and
		a child under 13 can't create an account. We don't identify children in
		analytics.
	</p>
	<p>
		A parent can review what we hold about a child, ask us to correct or
		delete it, or remove the child's profile from the household at any time.
		Contact us using the address below.
	</p>

	<h2>Who handles your data</h2>
	<p>We use these providers to run ChoreLoop:</p>
	<ul>
		<li>
			<strong>Neon:</strong> the database and sign-in service that store your
			account and household data.
		</li>
		<li>
			<strong>Vercel:</strong> hosting. Vercel keeps request logs.
		</li>
		<li>
			<strong>Resend:</strong> sends invitation emails, so it receives the
			invitee's email address.
		</li>
		<li>
			<strong>PostHog (US cloud):</strong> product analytics, session replay
			and error tracking.
		</li>
	</ul>
	<p>We don't sell personal data or use it for advertising.</p>

	<h2>Analytics, session replay and error tracking</h2>
	<p>
		In production we use PostHog to see which parts of ChoreLoop get used and
		to find and fix errors. It sends data from your browser and from our
		servers.
	</p>
	<ul>
		<li>
			Parents are identified by an internal user id only. We don't send their
			email address or name.
		</li>
		<li>
			Children are never identified, whether they use their own login or a
			managed profile. All we record is that the user is a kid.
		</li>
		<li>
			Session replays record what happens on screen, with typed values
			masked. Page addresses have their query strings removed.
		</li>
		<li>
			Clicks are recorded without the text of what was clicked, because that
			can include chore and member names.
		</li>
	</ul>

	<h2>Cookies and local storage</h2>
	<p>
		We use a cookie to keep you signed in. PostHog uses its own browser
		storage to recognise a returning visitor. We store some preferences, such
		as your chosen landing screen, on your device. We don't use advertising
		cookies.
	</p>

	<h2>How long we keep data</h2>
	<p>
		We keep household data while the account is active. When a parent removes
		a member, that member's profile is removed from the household, and the
		parent can choose to move their points to another member first. If you
		ask us to delete your account or household, we delete the data we hold
		about it, except where the law requires us to keep something.
	</p>

	<h2>Your choices</h2>
	<p>
		You can ask to see, correct or delete your data, or your household's
		data, by contacting us. If you live in the EU or UK you also have rights
		under data protection law, including objecting to processing and
		complaining to your local regulator.
	</p>

	<h2>Changes to this policy</h2>
	<p>
		If we change this policy we'll update the date at the top. For material
		changes we'll also tell signed-in parents when they next use ChoreLoop.
	</p>

	<h2>Contact us</h2>
	<p>
		Questions or requests about privacy: [contact address to be confirmed].
	</p>
</LegalPage>
