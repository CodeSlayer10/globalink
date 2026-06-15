import path from 'path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { init } from '../utils/init.ts';

export const initSpec = (nodePath: string) => {
	describe('init', () => {
		test('writes a config listing the given packages', async () => {
			await using fixture = await createFixture({});

			await init(['../package-binary', '../package-scoped'], {
				cwd: fixture.path,
				nodePath,
			});

			const config = await fixture.readJson('link.config.json') as {
				packages: string[];
			};

			expect(config.packages).toStrictEqual([
				'../package-binary',
				'../package-scoped',
			]);
			expect('deepLink' in config).toBe(false);
		});

		test('--deep records deepLink: true', async () => {
			await using fixture = await createFixture({});

			await init(['--deep', '../package-binary'], {
				cwd: fixture.path,
				nodePath,
			});

			const config = await fixture.readJson('link.config.json') as {
				deepLink?: boolean;
				packages: string[];
			};

			expect(config.deepLink).toBe(true);
			expect(config.packages).toStrictEqual(['../package-binary']);
		});

		test('no package paths scaffolds an empty template', async () => {
			await using fixture = await createFixture({});

			await init([], {
				cwd: fixture.path,
				nodePath,
			});

			const config = await fixture.readJson('link.config.json') as {
				packages: string[];
			};

			expect(config.packages).toStrictEqual([]);
		});

		test('does not overwrite an existing config', async () => {
			await using fixture = await createFixture({
				'link.config.json': JSON.stringify({ packages: ['../existing'] }),
			});

			const result = await init(['../package-binary'], {
				cwd: fixture.path,
				nodePath,
			});

			const config = await fixture.readJson('link.config.json') as {
				packages: string[];
			};

			// Untouched
			expect(config.packages).toStrictEqual(['../existing']);
			expect(result.stderr).toMatch('already exists');
			expect(result.exitCode).toBe(1);
		});
	});
};
