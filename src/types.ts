export type LinkConfig = {
	alias?: string;          // this package's alias, for others to depend on it
	deepLink?: boolean;      // during `-r`, whether to descend into this package's deps
	dependencies?: string[]; // aliases, package names, absolute paths, or relative paths
	scripts?: Record<string, string>; // named shell commands, run via `global run <name>`
};
