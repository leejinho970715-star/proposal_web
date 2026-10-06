import { build } from 'esbuild';
await build({ entryPoints: ['src/cloud-client.js'], bundle: true, format: 'esm', target: ['es2022'], outfile: 'proposal-site/dist/cloud-client.js', minify: true });
