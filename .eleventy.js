const fs = require( 'fs/promises' );
const path = require( 'path' );

module.exports = async function ( eleventyConfig ) {

	// Change stuff here first.
	const site = require( './src/_data/site.json' );

	const config = {
		dir: {
			input: 'src',
			includes: '_includes',
			output: '_site'
		},
		htmlTemplateEngine: 'njk',
		markdownTemplateEngine: 'njk',
		...site
	};

	// This is where everything is at.
	eleventyConfig.addWatchTarget( config.dir.input );

	// CSS just gets copied over, @sardine/eleventy-plugin-tinycss takes care of it.
	eleventyConfig.addTemplateFormats( 'css' );
	eleventyConfig.addExtension( 'css', {
		outputFileExtension: 'css',
		compile: async function ( inputContent, inputPath ) {
			return async () => inputContent;
		},
	} );

	// JS goes through esbuild so we don't have to worry about what we write.
	eleventyConfig.addTemplateFormats( 'js' );
	eleventyConfig.addExtension( 'js', {
		outputFileExtension: 'js',
		compile: async function ( inputContent, inputPath ) {

			// esbuild does the stuff...
			const esbuild = require( 'esbuild' );

			// Process each JS file through esbuild...
			const result = await esbuild.build( {
				entryPoints: [ inputPath ],
				bundle: true,
				write: false,
				platform: 'browser',
				treeShaking: true,
				format: 'iife', // Not a module.
				target: [ 'es2015' ], // Works in anything.
				legalComments: 'none',

				// Allow debugging at least.
				minify: ( process.env.ELEVENTY_ENV === 'production' ) ? true : false,
				sourcemap: ( process.env.ELEVENTY_ENV === 'production' ) ? false : true ,
			} );

			// Write the file esbuild gave us.
			return async () => result.outputFiles[0].text ?? '';
		},
	} );

	// Add support for simple bundling.
	const { EleventyRenderPlugin } = require( '@11ty/eleventy' );
	eleventyConfig.addPlugin( EleventyRenderPlugin );
	eleventyConfig.setTemplateFormats( [
		'html',
		'njk',
		'md',
		'xml'
	] );

	// Enables Eleventy’s bundle plugin and registers js/css/scss bundle channels so templates can collect code blocks and render them later where getBundle is called.
	eleventyConfig.addBundle( 'js' );
	eleventyConfig.addBundle( 'scss' );
	eleventyConfig.addBundle( 'css', {

		// Take any <style> and bundle it into a single <style>.
		bundleHtmlContentFromSelector: 'style'
	} );

	// https://www.npmjs.com/package/@sardine/eleventy-plugin-tinycss, makes all styles, purges (only link href=""), and inlines it all per-page.
	eleventyConfig.addPlugin( require( '@sardine/eleventy-plugin-tinycss' ), {
		output: `${ config.dir.output }/`,
		browserslist: 'last 2 version, not dead',
		purgeCSS: {
			fontFace: true,
			variables: true,
			keyframes: true,

			// @TODO File a bug to try and fix/solve this in the main repo.
			extractors: [
				{
					extensions: [ 'html' ],
					extractor: ( content ) => {

						return content
							// Remove <style> tags before assessing what to purge.
							.replace( /<style[\s\S]*?<\/style>/gi, '' )
							.match( /[A-Za-z0-9-_:\/]+/g ) || [];
					},
				},
			]
		}
	} );

	// 11ty-tools.
	eleventyConfig.addPlugin( require( '@aubreypwd/11ty-tools' ), { configFile: __filename } );

	// Add SASS support (handles boostrap if you have it).
	eleventyConfig.addPlugin(
		require( 'eleventy-sass' ),
		{
			sass: {
				silenceDeprecations: [
					'import',
					'global-builtin',
					'color-functions',
					'if-function'
				]
			}
		}
	);

	// Generate a sitemap.
	eleventyConfig.addPlugin( require( '@quasibit/eleventy-plugin-sitemap' ), {
		sitemap: {
			hostname: config.baseUrl,
		},
	} );

	// See base.html layout for what this does.
	eleventyConfig.addPlugin( require( 'eleventy-plugin-metagen' ) );

	// robots.txt, https://www.npmjs.com/package/eleventy-plugin-robotstxt
	eleventyConfig.addPlugin( require( 'eleventy-plugin-robotstxt'), {
		sitemapURL: `${ config.baseUrl }/sitemap.xml`,
		shouldBlockAIRobots: false,
		rules: new Map( [

			// AI Bots.
			[ 'GPTBot', [ { allow: '/' } ] ],
			[ 'ChatGPT-User', [ { allow: '/' } ] ],
			[ 'ClaudeBot', [ { allow: '/' } ] ],
			[ 'anthropic-ai', [ { allow: '/' } ] ],
			[ 'PerplexityBot', [ { allow: '/' } ] ],
			[ 'Google-Extended', [ { allow: '/' } ] ],
			[ 'Applebot-Extended', [ { allow: '/' } ] ],
			[ 'Amazonbot', [ { allow: '/' } ] ],
			[ 'Bytespider', [ { allow: '/' } ] ],

			// All others.
			[ '*', [ { allow: '/' } ] ],
		] )
	} );

	// llms.txt, https://www.npmjs.com/package/eleventy-plugin-llms
	eleventyConfig.addWatchTarget( path.resolve( './llms.md' ) );
	eleventyConfig.addPlugin( require( 'eleventy-plugin-llms' ), {
		siteUrl: config.baseUrl,
		includeDrafts: false,
		markdownOnly: false,

		// Modify _llms.md for instructions for large language models.
		headerText: `${ await fs.readFile( path.resolve( './llms.md' ), 'utf8' ) }\n# Pages:\n`
	} );

	// https://www.11ty.dev/docs/plugins/image/, auto-transforms <img> for us.
	const { eleventyImageTransformPlugin } = require( '@11ty/eleventy-img' );
	eleventyConfig.addPlugin( eleventyImageTransformPlugin, {
		outputDir: path.join( config.dir.output, 'assets/img' ),
		urlPath: '/assets/img',
		formats: [ 'avif', 'webp', 'jpeg' ],
		transformOnRequest: ( process.env.ELEVENTY_ENV === 'production' ) ? false : true,
		useCache: false,
		widths: [
			// 320,
			540,
			720,
			960,
			1140,
			// 1320,
			// 1920,
			'auto'
		],
		htmlOptions: {
			imgAttributes: {
				loading: 'lazy',
				decoding: 'async',
			}
		},

		// Place files here.
		filenameFormat: ( id, src, width, format, options ) => {
			return `${id}/${ path.parse( src ).name }-${width}.${format}`;
		},
	} );

	// Passthrough any /src/assets/img/passthrough > /docs/assets/img/*.webp.
	eleventyConfig.on( 'eleventy.after', async () => {

		const Image = require( '@11ty/eleventy-img' );

		const inputDir = path.resolve( config.dir.input, 'assets/img/passthrough' );
		const outputDir = path.resolve( config.dir.output, 'assets/img' );

		const files = await fs.readdir( inputDir, { recursive: true } );

		for ( const file of files ) {

			const inputPath = path.join( inputDir, file );

			await Image(
				inputPath,
				{
					formats: [ 'webp' ],
					outputDir: path.join( outputDir, path.dirname( file ) ),
					urlPath: '/assets/img/',
					filenameFormat: () => `${ path.parse( file ).name }.webp`
				}
			)
				.then( ( result ) => console.log( `Created ${ inputPath } -> ${ result.webp[0].outputPath }` ) )
				.catch( ( err ) => console.error( err ) );
		}
	} );

	// https://www.npmjs.com/package/eleventy-plugin-automatic-noopener, automatically add noopener, etc.
	eleventyConfig.addPlugin( require( 'eleventy-plugin-automatic-noopener' ) );

	// https://www.npmjs.com/package/@sardine/eleventy-plugin-tinyhtml, minify and optimize HTML.
	eleventyConfig.addPlugin( require( '@sardine/eleventy-plugin-tinyhtml' ), {
		removeAttributeQuotes: false,
		removeOptionalTags: false,
		removeComments: false,
		sortAttributes: false,
		sortClassName: false
	} );

	// Inline Google Font CSS.
	eleventyConfig.addPlugin( require( 'eleventy-google-fonts' ) );

	// Sanitize.css
	eleventyConfig.addPassthroughCopy( { 'node_modules/sanitize.css/*.css': 'assets/css/sanitize.css' } );

	return config;
};
