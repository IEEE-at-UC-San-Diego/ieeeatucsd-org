export async function fileSha256Base64(file: Blob): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		await file.arrayBuffer(),
	);
	const bytes = new Uint8Array(digest);
	return btoa(String.fromCharCode(...bytes));
}
