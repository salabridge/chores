/**
 * Every stories file ends with one "Visual test" story that renders all of
 * the file's other stories on one canvas (`VisualTestGrid`). Those are the
 * only stories Chromatic snapshots: everything else is opted out in
 * .storybook/preview.ts.
 *
 * The story's tags are written out in each file (`['visual-test',
 * '!autodocs']`) because Svelte CSF's indexer reads them statically.
 */
export const VISUAL_TEST_TAG = 'visual-test';

/**
 * For components that change layout at lg (SB-68): the same snapshot at the
 * phone frame's width and the desktop frame's, in light and dark.
 */
export const responsiveVisualTestParameters = {
	chromatic: {
		disableSnapshot: false,
		modes: {
			'light mobile': { theme: 'light', viewport: 402 },
			'dark mobile': { theme: 'dark', viewport: 402 },
			'light desktop': { theme: 'light', viewport: 1440 },
			'dark desktop': { theme: 'dark', viewport: 1440 },
		},
	},
};

/** Opts the visual-test story back in to Chromatic, in light and dark. */
export const visualTestParameters = {
	chromatic: {
		disableSnapshot: false,
		modes: {
			light: { theme: 'light' },
			dark: { theme: 'dark' },
		},
	},
};
