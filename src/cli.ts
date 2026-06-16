import { cli } from 'cleye';
import { linkCommand, linkFlags, runLink } from './commands/link/index.ts';
import { unlinkCommand } from './commands/unlink/index.ts';
import { getProjectCwd } from './utils/project-cwd.ts';

(async () => {
	const argv = cli({
		name: 'global',
		parameters: ['[dependencies...]'],
		flags: linkFlags,
		help: {
			description: 'A more global `npm link` ~ allowing you to easily recover complex links.',
			render: (nodes, renderers) => {
				nodes[0].data = 'global\n';
				return renderers.render(nodes);
			},
		},
		commands: [
			linkCommand,
			unlinkCommand,
		],
	}, async (parsed) => {
		const cwdProjectPath = await getProjectCwd();
		await runLink(
			cwdProjectPath,
			parsed._.dependencies,
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
