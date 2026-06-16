import path from 'path';
import { execaNode } from 'execa';

const linkBinPath = path.resolve('./dist/cli.js');

type Options = {
	cwd: string;
	nodePath: string;

	/**
	 * Isolated home directory for the global registry (`~/.globalink`). Defaults
	 * to the cwd so tests never touch the real user home.
	 */
	home?: string;
};

export const run = (
	cliArguments: string[],
	{
		cwd,
		nodePath,
		home,
	}: Options,
) => execaNode(
	linkBinPath,
	['run', ...cliArguments],
	{
		env: {
			HOME: home ?? cwd,
			USERPROFILE: home ?? cwd,
		},
		extendEnv: false,
		nodeOptions: [],
		cwd,
		nodePath,
		reject: false,
	},
);
