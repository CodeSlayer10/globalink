import fs from 'fs/promises';

export const getProjectCwd = () => fs.realpath(process.cwd());
