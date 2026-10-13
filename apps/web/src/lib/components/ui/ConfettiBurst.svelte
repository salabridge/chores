<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { MediaQuery } from 'svelte/reactivity';
	import { type ConfettiPiece, confettiPieces } from '#lib/chore-completion.js';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
		/** Defaults to the fixed set around the medallion. */
		pieces?: readonly ConfettiPiece[];
	}

	let { pieces = confettiPieces, class: className, ...rest }: Props = $props();

	// People who ask their system for less motion get the same pieces, sitting
	// still. The CSS below also guards on the media query, so this holds even
	// before this script runs.
	const reduceMotion = new MediaQuery('prefers-reduced-motion: reduce', false);

	const colors: Record<ConfettiPiece['color'], string> = {
		blue: 'bg-accent-blue',
		green: 'bg-accent-green',
		amber: 'bg-accent-amber',
		white: 'bg-text-default',
	};
</script>

<!-- Decorative: hidden from assistive tech. 140px square, centered on the medallion. -->
<div
	{...rest}
	aria-hidden="true"
	data-motion={reduceMotion.current ? 'reduced' : 'full'}
	class={['pointer-events-none absolute inset-0', className]}
>
	{#each pieces as piece, i (i)}
		<span
			data-piece
			class={['piece absolute', colors[piece.color], piece.round ? 'rounded-full' : 'rounded-[2px]']}
			style:left="{piece.x}px"
			style:top="{piece.y}px"
			style:width="{piece.width}px"
			style:height="{piece.height}px"
			style:--rotate="{piece.rotate}deg"
			style:--from-x="{70 - piece.x}px"
			style:--from-y="{70 - piece.y}px"
			style:--delay="{piece.delay}ms"
		></span>
	{/each}
</div>

<style>
	.piece {
		transform: rotate(var(--rotate));
	}

	/* The burst: pieces fly out from the medallion and settle where they are. */
	@media (prefers-reduced-motion: no-preference) {
		[data-motion='full'] .piece {
			animation: confetti-burst 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
			animation-delay: var(--delay);
		}
	}

	@keyframes confetti-burst {
		from {
			opacity: 0;
			transform: translate(var(--from-x), var(--from-y)) rotate(0deg) scale(0.2);
		}
		to {
			opacity: 1;
			transform: translate(0, 0) rotate(var(--rotate)) scale(1);
		}
	}
</style>
