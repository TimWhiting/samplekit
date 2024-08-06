import type { LoadedFrontMatter } from '$lib/articles/schema';
import imgSm from '/src/routes/articles/preprocessors/assets/preprocessors-thumbnail-1200w.webp';
export default {
	title: 'Blog with Preprocessors',
	implementationPath: '/articles/preprocessors/#interactive-demo',
	srcCodeHref: 'https://github.com/timothycohen/samplekit/blob/main/packages/markdown',
	description: 'Use preprocessors to format themed code blocks and Markdown tables alongside Svelte components.',
	publishedAt: new Date('2024-03-06T21:16:15.000Z'),
	authors: [{ name: 'Tim Cohen', email: 'contact@timcohen.dev' }],
	imgSm,
	tags: ['preprocessors', 'blog', 'markdown', 'code highlighting', 'DX'],
	featured: true,
	updates: [
		{ at: new Date('2024-03-20T20:11:27.000Z'), descriptions: ['Expand processor syntax beyond highlighting.'] },
		{ at: new Date('2024-03-21T17:59:53.000Z'), descriptions: ['Add formatLogFilename.'] },
	],
	articlePath: '/articles/preprocessors',
	wordCount: 2961,
	readingTime: 14,
	toc: [
		{
			title: 'Evaluating the Options',
			href: '/articles/preprocessors/#evaluating-the-options',
			children: [
				{ title: '0.1: Unified', href: '/articles/preprocessors/#0.1:-unified' },
				{ title: '0.2: MDsveX', href: '/articles/preprocessors/#0.2:-mdsvex' },
				{ title: '0.3: Preprocessors', href: '/articles/preprocessors/#0.3:-preprocessors' },
			],
		},
		{
			title: 'Integrating Preprocessors',
			href: '/articles/preprocessors/#integrating-preprocessors',
			children: [
				{ title: 'Setup', href: '/articles/preprocessors/#setup' },
				{
					title: 'Table Preprocessor',
					href: '/articles/preprocessors/#table-preprocessor',
					children: [
						{ title: 'Transformation Pipeline', href: '/articles/preprocessors/#transformation-pipeline' },
						{ title: 'Writing the Preprocessor', href: '/articles/preprocessors/#writing-the-preprocessor' },
					],
				},
				{
					title: 'Codeblock Preprocessor',
					href: '/articles/preprocessors/#codeblock-preprocessor',
					children: [
						{ title: 'Transformation Pipeline', href: '/articles/preprocessors/#transformation-pipeline' },
						{ title: 'Writing the Preprocessor', href: '/articles/preprocessors/#writing-the-preprocessor' },
					],
				},
			],
		},
		{ title: 'Conclusion', href: '/articles/preprocessors/#conclusion' },
	],
} satisfies LoadedFrontMatter;
