interface RefreshLogtoIdTokenInput {
	forceRefreshToken: boolean;
	clearAccessToken: () => Promise<unknown>;
	getAccessToken: () => Promise<string | null | undefined>;
	getIdToken: () => Promise<string | null | undefined>;
}

export async function refreshLogtoIdToken({
	forceRefreshToken,
	clearAccessToken,
	getAccessToken,
	getIdToken,
}: RefreshLogtoIdTokenInput) {
	if (forceRefreshToken) {
		await clearAccessToken();
		await getAccessToken();
	}

	return (await getIdToken()) ?? null;
}
