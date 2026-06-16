import path from 'path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { run } from '../utils/run.ts';

export const runScript = (nodePath: string) => {
	describe('run', () => {
		test('shows warning when no config file exists', async () => {
			await using fixture = await createFixture({
				'package-entry': {
					'package.json': JSON.stringify({ name: 'package-entry' }),
				},
			});

			const result = await run(['hello'], {
				cwd: path.join(fixture.path, 'package-entry'),
				nodePath,
			});

			expect(result.stderr).toMatch('Warning: Config file "link.config.json" not found');
		});

		test('runs a script defined in config', async () => {
			await using fixture = await createFixture({
				'package-entry': {
					'package.json': JSON.stringify({ name: 'package-entry' }),
					'link.config.json': JSON.stringify({
						scripts: { hello: 'echo hi-from-entry' },
					}),
				},
			});

			const result = await run(['hello'], {
				cwd: path.join(fixture.path, 'package-entry'),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch('hi-from-entry');
		});

		test('warns and exits 1 when no package defines the script', async () => {
			await using fixture = await createFixture({
				'package-entry': {
					'package.json': JSON.stringify({ name: 'package-entry' }),
					'link.config.json': JSON.stringify({
						scripts: { build: 'echo build' },
					}),
				},
			});

			const result = await run(['missing'], {
				cwd: path.join(fixture.path, 'package-entry'),
				nodePath,
			});

			expect(result.exitCode).toBe(1);
			expect(result.stderr).toMatch('No package defines a "missing" script');
		});

		test('-r runs deps-first (bottom-up)', async () => {
			await using fixture = await createFixture({
				'package-a': {
					'package.json': JSON.stringify({ name: 'package-a' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-b'],
						scripts: { greet: 'echo from-a' },
					}),
				},
				'package-b': {
					'package.json': JSON.stringify({ name: 'package-b' }),
					'link.config.json': JSON.stringify({
						scripts: { greet: 'echo from-b' },
					}),
				},
			});

			const result = await run(['greet', '-r'], {
				cwd: path.join(fixture.path, 'package-a'),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			// Dependency (b) runs before the dependent (a).
			expect(result.stdout.indexOf('from-b')).toBeLessThan(result.stdout.indexOf('from-a'));
		});

		test('-r runs a diamond dependency once', async () => {
			await using fixture = await createFixture({
				'package-a': {
					'package.json': JSON.stringify({ name: 'package-a' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-b', '../package-c'],
						scripts: { greet: 'echo from-a' },
					}),
				},
				'package-b': {
					'package.json': JSON.stringify({ name: 'package-b' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-d'],
						scripts: { greet: 'echo from-b' },
					}),
				},
				'package-c': {
					'package.json': JSON.stringify({ name: 'package-c' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-d'],
						scripts: { greet: 'echo from-c' },
					}),
				},
				'package-d': {
					'package.json': JSON.stringify({ name: 'package-d' }),
					'link.config.json': JSON.stringify({
						scripts: { greet: 'echo from-d' },
					}),
				},
			});

			const result = await run(['greet', '-r'], {
				cwd: path.join(fixture.path, 'package-a'),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout.match(/from-d/g)?.length).toBe(1);
		});

		test('-r stops descending at deepLink: false', async () => {
			await using fixture = await createFixture({
				'package-a': {
					'package.json': JSON.stringify({ name: 'package-a' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-b'],
						scripts: { greet: 'echo from-a' },
					}),
				},
				'package-b': {
					'package.json': JSON.stringify({ name: 'package-b' }),
					'link.config.json': JSON.stringify({
						deepLink: false,
						dependencies: ['../package-c'],
						scripts: { greet: 'echo from-b' },
					}),
				},
				'package-c': {
					'package.json': JSON.stringify({ name: 'package-c' }),
					'link.config.json': JSON.stringify({
						scripts: { greet: 'echo from-c' },
					}),
				},
			});

			const result = await run(['greet', '-r'], {
				cwd: path.join(fixture.path, 'package-a'),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			// b runs (it's a direct dep) but its own dep c is not descended into.
			expect(result.stdout).toMatch('from-b');
			expect(result.stdout).not.toMatch('from-c');
		});

		test('-r skips packages that lack the script', async () => {
			await using fixture = await createFixture({
				'package-a': {
					'package.json': JSON.stringify({ name: 'package-a' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-b'],
						scripts: { greet: 'echo from-a' },
					}),
				},
				'package-b': {
					'package.json': JSON.stringify({ name: 'package-b' }),
					'link.config.json': JSON.stringify({
						scripts: { other: 'echo from-b' },
					}),
				},
			});

			const result = await run(['greet', '-r'], {
				cwd: path.join(fixture.path, 'package-a'),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch('from-a');
			expect(result.stdout).not.toMatch('from-b');
		});

		test('-i filters which dependencies are descended into', async () => {
			await using fixture = await createFixture({
				'package-a': {
					'package.json': JSON.stringify({ name: 'package-a' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-b', '../package-c'],
						scripts: { greet: 'echo from-a' },
					}),
				},
				'package-b': {
					'package.json': JSON.stringify({ name: 'package-b' }),
					'link.config.json': JSON.stringify({
						scripts: { greet: 'echo from-b' },
					}),
				},
				'package-c': {
					'package.json': JSON.stringify({ name: 'package-c' }),
					'link.config.json': JSON.stringify({
						scripts: { greet: 'echo from-c' },
					}),
				},
			});

			const result = await run(['greet', '-r', '-i', 'package-b'], {
				cwd: path.join(fixture.path, 'package-a'),
				nodePath,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch('from-b');
			expect(result.stdout).not.toMatch('from-c');
			expect(result.stdout).toMatch('from-a');
		});

		test('a failing script halts the run with a non-zero exit', async () => {
			await using fixture = await createFixture({
				'package-a': {
					'package.json': JSON.stringify({ name: 'package-a' }),
					'link.config.json': JSON.stringify({
						dependencies: ['../package-b'],
						scripts: { greet: 'echo from-a' },
					}),
				},
				'package-b': {
					'package.json': JSON.stringify({ name: 'package-b' }),
					'link.config.json': JSON.stringify({
						scripts: { greet: 'exit 3' },
					}),
				},
			});

			const result = await run(['greet', '-r'], {
				cwd: path.join(fixture.path, 'package-a'),
				nodePath,
			});

			expect(result.exitCode).toBe(1);
			// b fails first (bottom-up), so a never runs.
			expect(result.stdout).not.toMatch('from-a');
		});
	});
};
