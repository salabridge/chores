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
