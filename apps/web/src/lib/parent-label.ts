/**
 * Sidebar footer text for the household's parents: names joined with "&"
 * ("Mom & Dad", "Mom, Dad & Gran") and a role line ("Co-Captains" for two or
 * more, "Captain" for one).
 */
export function parentLabel(names: string[]): { name: string; role: string } {
	const clean = names.map((n) => n.trim()).filter(Boolean);
	if (clean.length === 0) return { name: 'Parent', role: 'Captain' };
	const name =
		clean.length === 1
			? clean[0]
			: `${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]}`;
	return { name, role: clean.length > 1 ? 'Co-Captains' : 'Captain' };
}
