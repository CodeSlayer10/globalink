import path from 'path';
import { execaNode } from 'execa';

const cliBinPath = path.resolve('./dist/cli.js');

type Options = {
	cwd: string;
	nodePath: string;
};

export const unlink = (
	cliArguments: string[],
	{
		cwd,
		nodePath,
	}: Options,
) => execaNode(
	cliBinPath,
	['unlink', ...cliArguments],
	{
		env: {},
		extendEnv: false,
		nodeOptions: [],
		cwd,
		nodePath,
		reject: false,
	},
);
