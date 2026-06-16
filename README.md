<h1 align="center">global</h1>

<p align="center">A safer and enhanced version of <a href="https://docs.npmjs.com/cli/v8/commands/npm-link"><code>npm link</code></a>.</p>

Why is `npm link` unsafe? Read the [blog post](https://hirok.io/posts/avoid-npm-link).

### Features
- 🔗 Symlinks local packages into `node_modules` without global installs or dependency reinstalls
- 🗂 A global registry lets you link packages by name or alias — no path needed
- 🔥 A `link.config.json` config file for linking multiple packages at once
- 💫 Recursive linking across a whole dependency graph
- ▶️ Run scripts across linked packages with `global run`
- 🛡 Only resolves to local paths

## Install

```sh
npm install -g @merkaz-amit/global
```

This exposes the `global` command.

## Terminology

- **Dependency package** — the package getting linked (usually a library).
- **Consuming package** — the project you want to link the dependency into (usually an application).

	`consuming-package/node_modules/dependency-package` → `dependency-package`

## Usage

### Linking a package

From the _Consuming package_ directory, link a _Dependency package_:

```sh
global link <dependency>
```

A `<dependency>` can be an **absolute path, a relative path, a package name, or an alias**. Paths are resolved relative to the current project; bare names and aliases are looked up in the [global registry](#the-registry).

```sh
global link ../my-library           # relative path
global link /abs/path/to/my-library # absolute path
global link my-library              # package name (via registry)
global link my-lib                  # alias (via registry)
```

> Running `global <dependency>` with no subcommand is shorthand for `global link <dependency>`.

Each link:
- Creates a symbolic link at `node_modules/<package-name>` referencing the _Dependency package_.
- Symlinks the package's binaries into `node_modules/.bin/`.
- Records the dependency in the _Consuming package_'s `link.config.json`.
- Registers the _Dependency package_ in the [global registry](#the-registry) under its name and alias.

> **🛡️ Secure linking**
>
> Unlike `npm link`, it doesn't install the _Dependency package_ globally or re-install project dependencies.

### Unlinking

`global unlink` is the inverse of `link` — it removes the symlinks `link` created and drops the dependencies from `link.config.json`. A real installed directory is left intact.

```sh
global unlink <dependency>   # unlink specific packages
global unlink                # unlink everything in link.config.json
```

It accepts the same arguments, config fallback, and `--recursive` / `--include` / `--exclude` flags as `link`. Running `npm install` also restores `node_modules`.

### The registry

`global` maintains a registry at `~/.globalink/registry.json`, a map of `{ "<name-or-alias>": "<absolute-path>" }`. Every `global link` registers the linked package under its `package.json` `name` and, if set, its config `alias`.

Once a package is registered (by being linked at least once, or by running `global link --alias <name>` in it), any other project can link it by name or alias without knowing its path:

```sh
# In the library, register it under an alias
cd ../my-library
global link --alias my-lib

# In any consuming project — no path needed
global link my-lib
```

### Configuration file

Create a `link.config.json` at the root of the _Consuming package_ to set up links to multiple _Dependency packages_ at once.

```json
{
    "alias": "my-lib",
    "deepLink": true,
    "dependencies": [
        "/path/to/dependency-a",
        "../dependency-b",
        "dep-c-alias"
    ],
    "scripts": {
        "build": "pkgroll",
        "test": "node tests/index.ts"
    }
}
```

The configuration has the following schema:

```ts
type LinkConfig = {
    // This package's short handle — a registry key others can link by,
    // and matched by --include/--exclude. Does not change the linked name.
    alias?: string

    // During a recursive (-r) link/run, whether to descend into this
    // package's own dependencies. Defaults to descending; false stops here.
    deepLink?: boolean

    // Packages to link — each an alias, package name, absolute path, or relative path.
    dependencies?: string[]

    // Named shell commands, run via `global run <name>`.
    scripts?: Record<string, string>
}
```

To link everything in `dependencies`, run `global link` with no arguments:

```sh
global link
```

> **Note:** Path-based entries are machine-specific — prefer name/alias references for portability, and avoid committing machine-specific absolute paths to source control.

### Recursive linking

By default, `global link` only links the _Consuming package_'s direct dependencies. With `--recursive` (`-r`), it links from config, then descends into each dependency's own `link.config.json` and links _its_ dependencies too, and so on.

```sh
global link --recursive
```

Traversal stops at a package whose config sets `"deepLink": false`, or at a package it has already visited (diamond dependencies are deduped).

### Running scripts

`global run <script>` runs the matching entry from the config's `scripts` map. The command runs with the package's `node_modules/.bin` on `PATH`, and its output is streamed.

```sh
global run build
```

With `--recursive` (`-r`), the script runs across the dependency graph **deps-first** (post-order) — each dependency's script runs before the dependent's.

```sh
global run build --recursive
```

- Packages that don't define the named script are skipped silently.
- A non-zero exit halts the chain.
- If no package in the graph defines the script, it warns and exits with code 1.

### Filtering which packages to act on

When operating from `link.config.json`, use `--include` / `-i` and `--exclude` / `-e` to act on only a subset of configured dependencies. Both flags are repeatable and match against each dependency's raw config string, its `package.json` `name`, and its config `alias`.

```sh
# Only act on the matching dependencies
global link --include dependency-a --include dependency-b

# Act on everything except the matching dependencies
global link --exclude dependency-c

# Match by alias
global link -i a
```

Filtering applies only to the config flow (`link` / `unlink` / `run` with no path arguments) — it does not affect dependencies passed directly on the command line. Under `--recursive`, the filters are threaded through every level of the traversal.

## FAQ

### Why should I use `global` over `npm link`?

Because `npm link` [is complicated and dangerous to use](https://hirok.io/posts/avoid-npm-link). `global` only resolves to local paths, doesn't touch your global installs, and keeps a recoverable record of every link in `link.config.json` and the registry.

### How do I remove the links?

Run `global unlink`, or run `npm install` — it enforces the integrity of `node_modules` and reverts the links as a side effect.
