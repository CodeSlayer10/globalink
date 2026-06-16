import path from 'path';
import { describe, test, expect } from 'manten';
import { execa, execaNode } from 'execa';
import { createFixture } from 'fs-fixture';
import { link } from '../utils/link.ts';

export const linkConfig = (nodePath: string) => {
	describe('link.config.json', () => {
		test('shows warning when no config file exists', async () => {
			await using fixture = await createFixture({
				'package-entry': {
					'package.json': JSON.stringify({ name: 'package-entry' }),
				},
			});

			const entryPackagePath = path.join(fixture.path, 'package-entry');

			const result = await link([], {
				cwd: entryPackagePath,
				nodePath,
			});

			expect(result.stderr).toMatch('Warning: Config file "link.config.json" not found');
		});

		test('fails with parse error for invalid JSON', async () => {
			await using fixture = await createFixture({
				'package-entry': {
					'package.json': JSON.stringify({ name: 'package-entry' }),
					'link.config.json': '{ invalid json }',
				},
			});

			const entryPackagePath = path.join(fixture.path, 'package-entry');

			const result = await link([], {
				cwd: entryPackagePath,
				nodePath,
			});

			expect(result.exitCode).toBe(1);
			expect(result.stderr).toMatch('Failed to parse config JSON');
		});

		test('handles empty dependencies array', async () => {
			await using fixture = await createFixture({
				'package-entry': {
					'package.json': JSON.stringify({ name: 'package-entry' }),
					'link.config.json': JSON.stringify({ dependencies: [] }),
				},
			});

			const entryPackagePath = path.join(fixture.path, 'package-entry');

			const result = await link([], {
				cwd: entryPackagePath,
				nodePath,
			});

			// Should succeed with no dependencies to link
			expect(result.exitCode).toBe(0);
		});

		test('symlink', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const entryPackagePath = path.join(fixture.path, 'package-entry');

			await fixture.writeJson('package-entry/link.config.json', {
				dependencies: [
					// Relative path & binary
					'../package-binary',

					// Absolute path
					path.join(fixture.path, 'package-files'),

					// Package with @org in name
					'../package-scoped',

					'../nested/package-deep-link',
				],
			});

			await link([], {
				cwd: entryPackagePath,
				nodePath,
			});

			const entryPackage = await execaNode(
				path.join(entryPackagePath, 'index.js'),
				[],
				{
					nodePath,
					nodeOptions: [],
				},
			);
			expect(entryPackage.stdout).toBe('["package-entry","package-binary","package-files","@scope/package-scoped",["package-deep-link",null,null]]');

			// Executable via npm
			await fixture.writeJson('package-entry/package.json', {
				scripts: {
					test: 'binary',
				},
			});
			const binaryNpm = await execa('npm', ['test'], {
				cwd: entryPackagePath,
			});
			expect(binaryNpm.stdout).toMatch('package-binary');

			const binary = await execa(path.join(entryPackagePath, 'node_modules/.bin/binary'));
			expect(binary.stdout).toBe('package-binary');

			const nonPublishFileExists = await fixture.exists('package-entry/node_modules/package-files/non-publish-file.js');
			expect(nonPublishFileExists).toBe(true);
		});

		test('creates/updates config and registers from `link <path> -a -d`', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const entryPackagePath = path.join(fixture.path, 'package-entry');

			const result = await link(['../package-binary', '-a', 'entry-alias', '-d'], {
				cwd: entryPackagePath,
				nodePath,
				home: fixture.path,
			});

			expect(result.exitCode).toBe(0);

			// The dependency was symlinked
			expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(true);

			// The config was created with alias, deepLink and the dependency
			const config = await fixture.readJson('package-entry/link.config.json') as Record<string, unknown>;
			expect(config.alias).toBe('entry-alias');
			expect(config.deepLink).toBe(true);
			expect(config.dependencies).toStrictEqual(['../package-binary']);

			// The package was registered globally by name and alias
			const registry = await fixture.readJson('.globalink/registry.json') as Record<string, string>;
			expect(registry['package-entry']).toBe(entryPackagePath);
			expect(registry['entry-alias']).toBe(entryPackagePath);
		});

		test('preserves alias/deepLink but replaces dependencies', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const entryPackagePath = path.join(fixture.path, 'package-entry');

			await fixture.writeJson('package-entry/link.config.json', {
				alias: 'keep-me',
				deepLink: true,
				dependencies: ['../package-binary'],
			});

			await link(['../package-scoped'], {
				cwd: entryPackagePath,
				nodePath,
				home: fixture.path,
			});

			const config = await fixture.readJson('package-entry/link.config.json') as Record<string, unknown>;
			// alias/deepLink preserved (not passed this time)
			expect(config.alias).toBe('keep-me');
			expect(config.deepLink).toBe(true);
			// dependencies replaced with what was passed this time
			expect(config.dependencies).toStrictEqual(['../package-scoped']);
		});

		test('resolves a dependency by alias from the registry', async () => {
			await using fixture = await createFixture('./tests/fixtures/');
			const binaryPackagePath = path.join(fixture.path, 'package-binary');
			const entryPackagePath = path.join(fixture.path, 'package-entry');

			// Register package-binary under an alias
			await link(['-a', 'my-bin'], {
				cwd: binaryPackagePath,
				nodePath,
				home: fixture.path,
			});

			// Link it into package-entry by its alias
			const result = await link(['my-bin'], {
				cwd: entryPackagePath,
				nodePath,
				home: fixture.path,
			});

			expect(result.exitCode).toBe(0);
			expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(true);

			const config = await fixture.readJson('package-entry/link.config.json') as Record<string, unknown>;
			expect(config.dependencies).toStrictEqual(['my-bin']);
		});

		describe('recursive (-r)', () => {
			test('descends into dependency configs', async () => {
				await using fixture = await createFixture('./tests/fixtures/');
				const entryPackagePath = path.join(fixture.path, 'package-entry');

				await fixture.writeJson('package-entry/link.config.json', {
					dependencies: [
						'../package-binary',
						path.join(fixture.path, 'package-files'),
						'../package-scoped',
						'../nested/package-deep-link',
					],
				});

				await link(['-r'], {
					cwd: entryPackagePath,
					nodePath,
				});

				const entryPackage = await execaNode(
					path.join(entryPackagePath, 'index.js'),
					[],
					{
						nodePath,
						nodeOptions: [],
					},
				);
				expect(entryPackage.stdout).toBe('["package-entry","package-binary","package-files","@scope/package-scoped",["package-deep-link","package-files","@scope/package-scoped"]]');
			});

			test('stops descending at deepLink: false', async () => {
				await using fixture = await createFixture('./tests/fixtures/');
				const entryPackagePath = path.join(fixture.path, 'package-entry');

				await fixture.writeJson('package-entry/link.config.json', {
					dependencies: ['../nested/package-deep-link'],
				});

				// Mark the dependency as a boundary
				await fixture.writeJson('nested/package-deep-link/link.config.json', {
					deepLink: false,
					dependencies: ['../../package-files', '../../package-scoped'],
				});

				await link(['-r'], {
					cwd: entryPackagePath,
					nodePath,
				});

				// package-deep-link is linked into the entry
				expect(await fixture.exists('package-entry/node_modules/package-deep-link')).toBe(true);
				// ...but its own dependencies are NOT linked into it (boundary)
				expect(await fixture.exists('nested/package-deep-link/node_modules/package-files')).toBe(false);
				expect(await fixture.exists('nested/package-deep-link/node_modules/@scope/package-scoped')).toBe(false);
			});

			test('terminates on circular config references', async () => {
				await using fixture = await createFixture({
					'package-a': {
						'package.json': JSON.stringify({ name: 'package-a' }),
						'link.config.json': JSON.stringify({
							dependencies: ['../package-b'],
						}),
					},
					'package-b': {
						'package.json': JSON.stringify({ name: 'package-b' }),
						'link.config.json': JSON.stringify({
							dependencies: ['../package-a'],
						}),
					},
				});

				const result = await link(['-r'], {
					cwd: path.join(fixture.path, 'package-a'),
					nodePath,
				});

				expect(result.exitCode).toBe(0);
				expect(await fixture.exists('package-a/node_modules/package-b')).toBe(true);
				expect(await fixture.exists('package-b/node_modules/package-a')).toBe(true);
			});
		});

		describe('filtering', () => {
			const writeConfig = (fixture: Awaited<ReturnType<typeof createFixture>>) => (
				fixture.writeJson('package-entry/link.config.json', {
					dependencies: [
						'../package-binary',
						path.join(fixture.path, 'package-files'),
						'../package-scoped',
					],
				})
			);

			test('--include links only matching dependencies by name', async () => {
				await using fixture = await createFixture('./tests/fixtures/');
				const entryPackagePath = path.join(fixture.path, 'package-entry');
				await writeConfig(fixture);

				await link(['--include', 'package-binary'], {
					cwd: entryPackagePath,
					nodePath,
				});

				expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(true);
				expect(await fixture.exists('package-entry/node_modules/package-files')).toBe(false);
				expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(false);
			});

			test('--exclude skips matching dependencies by name', async () => {
				await using fixture = await createFixture('./tests/fixtures/');
				const entryPackagePath = path.join(fixture.path, 'package-entry');
				await writeConfig(fixture);

				await link(['--exclude', 'package-binary'], {
					cwd: entryPackagePath,
					nodePath,
				});

				expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(false);
				expect(await fixture.exists('package-entry/node_modules/package-files')).toBe(true);
				expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(true);
			});

			test('-i matches against a package alias', async () => {
				await using fixture = await createFixture('./tests/fixtures/');
				const entryPackagePath = path.join(fixture.path, 'package-entry');
				await writeConfig(fixture);

				// package-files declares an alias in its own config
				await fixture.writeJson('package-files/link.config.json', {
					alias: 'files-alias',
				});

				await link(['-i', 'files-alias'], {
					cwd: entryPackagePath,
					nodePath,
				});

				expect(await fixture.exists('package-entry/node_modules/package-files')).toBe(true);
				expect(await fixture.exists('package-entry/node_modules/package-binary')).toBe(false);
				expect(await fixture.exists('package-entry/node_modules/@scope/package-scoped')).toBe(false);
			});
		});
	});
};
