import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import ConvexProvider from "../integrations/convex/provider";
import AppLogtoProvider from "../integrations/logto/provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content:
					"width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5",
			},
			{
				title: "IEEE UCSD Dashboard",
			},
			{
				name: "theme-color",
				content: "#006bff",
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes",
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "default",
			},
			{
				name: "apple-mobile-web-app-title",
				content: "IEEE UCSD",
			},
			{
				name: "mobile-web-app-capable",
				content: "yes",
			},
			{
				name: "description",
				content:
					"IEEE at UC San Diego member dashboard — events, reimbursements, and chapter tools.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
			{
				rel: "icon",
				href: "/favicon.ico",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
		],
	}),

	component: RootComponent,
	shellComponent: RootDocument,
	notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
			<div className="w-full max-w-sm space-y-4 text-center">
				<h1 className="text-4xl font-bold tracking-tight">404</h1>
				<p className="text-muted-foreground">Page not found</p>
				<a
					href="/overview"
					className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground active:scale-[0.97]"
				>
					Go to Dashboard
				</a>
			</div>
		</div>
	);
}

function HydrationCleanupScript() {
	return (
		<script
			dangerouslySetInnerHTML={{
				__html: [
					// Runs in <head> before React hydrates the <body>.
					// 1. Strips browser-extension-injected data-* attrs (e.g. data-qb-installed)
					// 2. Strips the serialized suppresshydrationwarning HTML attribute
					//    (React adds it during SSR but treats it as a React-internal prop during hydration)
					// 3. Uses MutationObserver to catch extensions that inject after initial parse
					`(function(){`,
					`var h=document.documentElement;`,
					`function c(){var a=h.getAttributeNames(),i=a.length;while(i--){var n=a[i];`,
					`if((n.startsWith("data-")&&!n.startsWith("data-tsd-"))||n==="suppresshydrationwarning")h.removeAttribute(n)}}`,
					`c();`,
					`var o=new MutationObserver(function(){c()});`,
					`o.observe(h,{attributes:true});`,
					`setTimeout(function(){o.disconnect()},5000);`,
					`})()`,
				].join(""),
			}}
		/>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<HydrationCleanupScript />
			</head>
			<body suppressHydrationWarning>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	if (pathname.startsWith("/accept-invitation/")) {
		return <Outlet />;
	}

	return (
		<AppLogtoProvider>
			<ConvexProvider>
				<AuthProvider>
					<Outlet />
					<Toaster theme="light" position="bottom-right" />
				</AuthProvider>
			</ConvexProvider>
		</AppLogtoProvider>
	);
}
