import * as React from "react";

type MobileShellContextValue = {
	hideTabBar: boolean;
	setHideTabBar: (hide: boolean) => void;
};

const MobileShellContext = React.createContext<MobileShellContextValue>({
	hideTabBar: false,
	setHideTabBar: () => {},
});

export function MobileShellProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [hideTabBar, setHideTabBar] = React.useState(false);

	const value = React.useMemo(
		() => ({ hideTabBar, setHideTabBar }),
		[hideTabBar],
	);

	return (
		<MobileShellContext.Provider value={value}>
			{children}
		</MobileShellContext.Provider>
	);
}

export function useMobileShell() {
	return React.useContext(MobileShellContext);
}
