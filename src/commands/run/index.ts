import { command } from 'cleye';
import { outdent } from 'outdent';
import { runScriptFromConfig } from '../../run-script/index.ts';
import { loadConfig } from '../../utils/load-config.ts';
import { getProjectCwd } from '../../utils/project-cwd.ts';

export const runCommand = command({
	name: 'run',
	parameters: ['<script>'],
	flags: {
		recursive: {
			type: Boolean,
			alias: 'r',
			description: 'Run the script in dependencies (deps-first), descending through configs',
		},
		include: {
			type: [String],
			alias: 'i',
			description: 'Only descend into dependencies whose name or alias matches (repeatable)',
		},
		exclude: {
			type: [String],
			alias: 'e',
			description: 'Skip dependencies whose name or alias matches (repeatable)',
		},
	},
	help: {
		description: 'Run a script from link.config.json, optionally across linked dependencies (-r)',
	},
}, async (argv) => {
	const cwdProjectPath = await getProjectCwd();
	const config = await loadConfig(cwdProjectPath);

	if (!config) {
		console.warn(
			outdent`
			Warning: Config file "link.config.json" not found in current directory.
			`,
		);
		argv.showHelp();
		return;
	}

	await runScriptFromConfig(
		cwdProjectPath,
		config,
		argv._.script,
		{
			include: argv.flags.include,
			exclude: argv.flags.exclude,
		},
		Boolean(argv.flags.recursive),
	);
});
