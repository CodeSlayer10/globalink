import { describe } from 'manten';
import getNode from 'get-node';
import { cli } from './specs/cli.spec.ts';
import { linkConfig } from './specs/link-config.spec.ts';
import { unlinkSpec } from './specs/unlink.spec.ts';
import { registrySpec } from './specs/registry.spec.ts';
import { symlinkSpec } from './specs/symlink.spec.ts';
import { utils } from './specs/utils.spec.ts';
import { runScript } from './specs/run-script.spec.ts';

const nodeVersions = [
	'20',
	...(
		process.env.CI
			? [
				'18',
			]
			: []
	),
];

(async () => {
	for (const nodeVersion of nodeVersions) {
		const node = await getNode(nodeVersion);
		await describe(`Node ${node.version}`, () => {
			cli(node.path);
			linkConfig(node.path);
			unlinkSpec(node.path);
			registrySpec(node.path);
			symlinkSpec(node.path);
			utils(node.path);
			runScript(node.path);
		});
	}
})();
