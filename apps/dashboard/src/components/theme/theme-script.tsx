/**
 * Blocking FOUC script — must run in <head> before paint.
 * Mirrors next-themes resolution for storageKey "ieee-dashboard-theme".
 */
export function ThemeScript() {
	const script = `(function(){try{var k='ieee-dashboard-theme';var t=localStorage.getItem(k);var d=t==='dark'||((t==null||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#000000':'#006bff')}catch(e){}})()`;

	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: FOUC prevention must run before paint
			dangerouslySetInnerHTML={{ __html: script }}
		/>
	);
}
