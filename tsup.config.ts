import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  external: [],
  noExternal: [
    '@actions/core',
    '@actions/exec',
    '@actions/io',
    '@actions/tool-cache'
  ]
});
