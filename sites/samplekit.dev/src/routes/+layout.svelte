<script lang="ts">
	import '@samplekit/preprocess-katex/katex.css';
	import '../app.css';
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { createTurnstileLoadedFlagCtx } from '$lib/bot-protection/turnstile/client';
	import { Header, SEO } from '$lib/components';
	import { createMobileNavCtx } from '$lib/components/layout';
	import { GH_BLOB } from '$lib/consts';
	import { createThemeControllerCtx, ThemeToggler } from '$lib/styles';

	const { children, data } = $props();

	createThemeControllerCtx(data.initialTheme);
	createMobileNavCtx();
	createTurnstileLoadedFlagCtx();

	const smoothNavigationOnlyOnSamePage = () => {
		if (browser) document.documentElement.style.scrollBehavior = 'smooth';

		beforeNavigate(({ from, to }) => {
			if (from?.route.id === to?.route.id) return;
			document.documentElement.style.scrollBehavior = 'auto';
		});

		afterNavigate(() => {
			tick().then(() => {
				document.documentElement.style.scrollBehavior = 'smooth';
			});
		});
	};

	smoothNavigationOnlyOnSamePage();
</script>

<SEO meta={$page.data.meta} />

{#if $page.data.layout.showHeader}
	<Header>
		<ThemeToggler />
	</Header>
{/if}

<div class="{$page.data.layout.showHeader ? 'min-h-screen-nav' : 'min-h-screen'} relative flex flex-col">
	<main class="flex min-h-full flex-1 flex-col">
		{@render children()}
	</main>

	{#if $page.data.layout.showFooter}
		<footer class="p-4 text-center">
			<div class="flex justify-center gap-2">
				<span>A project by <a class="link" href="mailto:contact@timcohen.dev">Timothy Cohen</a> </span>
				|
				<a class="link" href="{GH_BLOB}/LICENSE"> MIT License </a>
			</div>
		</footer>
	{/if}
</div>
