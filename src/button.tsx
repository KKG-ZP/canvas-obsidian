import { useState, type CSSProperties, type ReactNode } from "react";
import { useHostTheme } from "@thisismydesign/cursor-canvas-web";

type ButtonVariant = "primary" | "secondary" | "ghost";

export type CanvasButtonProps = {
	children?: ReactNode;
	variant?: ButtonVariant;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
	style?: CSSProperties;
	onClick?: () => void;
};

/** 20px type with a 1.2 line height. Vertical padding keeps the border off the glyphs. */
export function Button({
	children,
	variant = "secondary",
	disabled,
	type = "button",
	style,
	onClick,
}: CanvasButtonProps) {
	const theme = useHostTheme();
	const [hovered, setHovered] = useState(false);
	const colors = buttonColors(variant, hovered, theme);

	return (
		<button
			type={type}
			disabled={disabled}
			onClick={onClick}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				height: "auto",
				padding: "6px 12px",
				fontSize: 20,
				lineHeight: 1.2,
				fontWeight: 500,
				fontFamily: "inherit",
				borderRadius: 6,
				border: `1px solid ${colors.border}`,
				background: colors.background,
				color: colors.color,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: "auto",
				maxWidth: "100%",
				boxSizing: "border-box",
				cursor: disabled ? "default" : "pointer",
				opacity: disabled ? 0.5 : 1,
				whiteSpace: "nowrap",
				flex: "0 0 auto",
				...style,
			}}
		>
			{children}
		</button>
	);
}

type HostTheme = ReturnType<typeof useHostTheme>;

function buttonColors(variant: ButtonVariant, hovered: boolean, theme: HostTheme) {
	if (variant === "primary") {
		return {
			background: hovered ? theme.accent.controlHover : theme.accent.control,
			color: theme.text.onAccent,
			border: "transparent",
		};
	}
	if (variant === "ghost") {
		return {
			background: hovered ? theme.fill.tertiary : "transparent",
			color: theme.text.primary,
			border: "transparent",
		};
	}
	return {
		background: hovered ? theme.fill.secondary : theme.fill.tertiary,
		color: theme.text.primary,
		border: theme.stroke.primary,
	};
}
