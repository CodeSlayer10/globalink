import path from 'path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { link } from '../utils/link.ts';
import { unlink } from '../utils/unlink.ts';

export const unlinkSpec = (nodePath: string) => {
	describe('unlink', () => {
		const writeConfig = (fixture: Awaited<ReturnType<typeof createFixture>>) => (
			fixture.writeJson('package-entry/link.config.json', {
				packages: [
					'../package-binary',
					path.join(fixture.path, 'package-files'),
					'../package-scoped',
				],
			})
		);

		test('round trip removes symlinks and binaries from config', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const entryPackagePath = path.join(fixture.path, 'package-entry');
			await writeConfig(fixture);

			await link([], {
				cwd: entryPackagePath,
				nodePath,
			});

			// Sanity: everything is linked
			expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(true);
			expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(true);
			expect(await fixture.exists('package-entry/node_modules/.bin/binary')).toBe(true);

			await unlink([], {
				cwd: entryPackagePath,
				nodePath,
			});

			expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(false);
			expect(await fixture.exists('package-entry/node_modules/package-files')).toBe(false);
			expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(false);
			expect(await fixture.exists('package-entry/node_modules/.bin/binary')).toBe(false);
			expect(await fixture.exists('package-entry/node_modules/.bin/package-scoped')).toBe(false);
		});

		test('positional paths unlink only the given package', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const entryPackagePath = path.join(fixture.path, 'package-entry');
			await writeConfig(fixture);

			await link([], {
				cwd: entryPackagePath,
				nodePath,
			});
			await unlink(['../package-binary'], {
				cwd: entryPackagePath,
				nodePath,
			});

			expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(false);
			expect(await fixture.exists('package-entry/node_modules/package-files')).toBe(true);
			expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(true);
		});

		test('--deep removes nested symlinks', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const entryPackagePath = path.join(fixture.path, 'package-entry');

			await fixture.writeJson('package-entry/link.config.json', {
				packages: [
					'../package-binary',
					path.join(fixture.path, 'package-files'),
					'../package-scoped',
					'../nested/package-deep-link',
				],
			});

			await link(['--deep'], {
				cwd: entryPackagePath,
				nodePath,
			});

			// Nested deep link exists
			expect(await fixture.exists('nested/package-deep-link/node_modules/package-files')).toBe(true);
			expect(await fixture.exists('nested/package-deep-link/node_modules/@scope/package-scoped')).toBe(true);

			await unlink(['--deep'], {
				cwd: entryPackagePath,
				nodePath,
			});

			expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(false);
			expect(await fixture.exists('package-entry/node_modules/package-deep-link')).toBe(false);
			expect(await fixture.exists('nested/package-deep-link/node_modules/package-files')).toBe(false);
			expect(await fixture.exists('nested/package-deep-link/node_modules/@scope/package-scoped')).toBe(false);
		});

		describe('filtering', () => {
			test('--include unlinks only matching packages by name', async () => {
				await using fixture = await createFixture('./tests/fixtures/');
				const entryPackagePath = path.join(fixture.path, 'package-entry');
				await writeConfig(fixture);

				await link([], {
					cwd: entryPackagePath,
					nodePath,
				});
				await unlink(['--include', 'package-binary'], {
					cwd: entryPackagePath,
					nodePath,
				});

				expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(false);
				expect(await fixture.exists('package-entry/node_modules/package-files')).toBe(true);
				expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(true);
			});

			test('--exclude keeps matching packages linked', async () => {
				await using fixture = await createFixture('./tests/fixtures/');
				const entryPackagePath = path.join(fixture.path, 'package-entry');
				await writeConfig(fixture);

				await link([], {
					cwd: entryPackagePath,
					nodePath,
				});
				await unlink(['--exclude', 'package-binary'], {
					cwd: entryPackagePath,
					nodePath,
				});

				expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(true);
				expect(await fixture.exists('package-entry/node_modules/package-files')).toBe(false);
				expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(false);
			});
		});

		test('leaves real (non-symlink) directories intact with a warning', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const entryPackagePath = path.join(fixture.path, 'package-entry');
			await writeConfig(fixture);

			// A real install, not a symlink
			await fixture.mkdir('package-entry/node_modules/package-binary');
			await fixture.writeJson('package-entry/node_modules/package-binary/package.json', {
				name: 'package-binary',
			});

			const result = await unlink([], {
				cwd: entryPackagePath,
				nodePath,
			});

			expect(await fixture.exists('package-entry/node_modules/package-binary/package.json')).toBe(true);
			expect(result.stdout + result.stderr).toMatch('not a symlink');
		});

		test('shows warning when no config file exists', async () => {
			await using fixture = await createFixture({
				'package-entry': {
					'package.json': JSON.stringify({ name: 'package-entry' }),
				},
			});

			const entryPackagePath = path.join(fixture.path, 'package-entry');

			const result = await unlink([], {
				cwd: entryPackagePath,
				nodePath,
			});

			expect(result.stderr).toMatch('Warning: Config file "link.config.json" not found');
		});
	});
};
