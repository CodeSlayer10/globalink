import { cli } from 'cleye';
import { linkCommand, runLink } from './commands/link/index.ts';
import { unlinkCommand } from './commands/unlink/index.ts';
import { publishCommand } from './commands/publish/index.ts';
import { initCommand } from './commands/init/index.ts';
import { getProjectCwd } from './utils/project-cwd.ts';

(async () => {
	const argv = cli({
		name: 'global',
		parameters: ['[package paths...]'],
		flags: {
			deep: {
				type: Boolean,
				alias: 'd',
				description: 'Run `global link` on dependencies if they have a link.config.json',
			},
			include: {
				type: [String],
				alias: 'i',
				description: 'Only link packages whose name or alias matches (repeatable)',
			},
			exclude: {
				type: [String],
				alias: 'e',
				description: 'Skip packages whose name or alias matches (repeatable)',
			},
		},
		help: {
			description: 'A better `npm link` -- symlink local dependencies to the current project',

			render: (nodes, renderers) => {
				nodes[0].data = 'global\n';

				nodes.splice(2, 0, {
					type: 'section',
					data: {
						title: 'Website',
						body: 'https://www.npmjs.com/package/link',
					},
				});

				return renderers.render(nodes);
			},
		},
		commands: [
			linkCommand,
			unlinkCommand,
			publishCommand,
			initCommand,
		],
	}, async (parsed) => {
		const cwdProjectPath = await getProjectCwd();
		await runLink(
			cwdProjectPath,
			parsed._.packagePaths,
			parsed.flags,
			parsed.showHelp,
		);
	});

	// Awaiting resolves the matched command's (or root's) async callback so
	// errors surface to the catch below.
	await argv;
})().catch((error) => {
	console.error('Error:', error.message);
	process.exit(1);
});
