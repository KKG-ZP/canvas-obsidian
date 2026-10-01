import postcss from "postcss";

export function scopeMantineCss(css) {
	const root = postcss.parse(css);
	root.walkRules((rule) => {
		rule.selectors = rule.selectors.flatMap((selector) => {
			const reset = selector.trim();
			if (reset === "body") return [".cursor-canvas-host"];
			if (reset.startsWith(":root")) return [reset.replace(/^:root/, ".cursor-canvas-host")];
			// Keep resets at element specificity so component styles still win.
			if (["input", "button", "textarea", "select"].includes(reset)) {
				return [`:where(.cursor-canvas-host) ${reset}`];
			}
			if (/^\*(?:::?(?:before|after))?$/.test(reset)) {
				const pseudo = reset.slice(1);
				return [`:where(.cursor-canvas-host)${pseudo}`, `:where(.cursor-canvas-host) ${reset}`];
			}
			return [selector];
		});
	});
	return root.toString();
}
