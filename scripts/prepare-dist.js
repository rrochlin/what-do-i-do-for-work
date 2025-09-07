#!/usr/bin/env node
/*
 Prepares the dist/ folder for Vercel static hosting when Output Directory = dist
 - Copies plugin/ and assets/ into dist/
 - Rewrites index.html asset paths to be relative to dist/
*/
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyRecursive(src, dest) {
  // Prefer fs.cp when available (Node >=16.7)
  if (fs.cp) {
    await fsp.cp(src, dest, { recursive: true, force: true });
    return;
  }
  const stat = await fsp.stat(src);
  if (stat.isDirectory()) {
    await ensureDir(dest);
    const entries = await fsp.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await ensureDir(path.dirname(dest));
    await fsp.copyFile(src, dest);
  }
}

async function rewriteIndexHtml(rootDir, distDir) {
  const srcFile = path.join(rootDir, 'index.html');
  let html = await fsp.readFile(srcFile, 'utf8');

  // Rewrite dist/ asset paths to local files within dist/
  html = html.replace(/(href|src)=("|')dist\//g, '$1=$2./');

  // Rewrite plugin and assets to be relative to dist/
  html = html.replace(/(href|src)=("|')plugin\//g, '$1=$2./plugin/');
  html = html.replace(/(href|src|data-background-image)=("|')assets\//g, '$1=$2./assets/');

  const destFile = path.join(distDir, 'index.html');
  await fsp.writeFile(destFile, html, 'utf8');
}

async function main() {
  const rootDir = process.cwd();
  const distDir = path.join(rootDir, 'dist');

  await ensureDir(distDir);

  // Copy plugin/ and assets/ into dist/
  const pluginSrc = path.join(rootDir, 'plugin');
  if (fs.existsSync(pluginSrc)) {
    await copyRecursive(pluginSrc, path.join(distDir, 'plugin'));
  }

  const assetsSrc = path.join(rootDir, 'assets');
  if (fs.existsSync(assetsSrc)) {
    await copyRecursive(assetsSrc, path.join(distDir, 'assets'));
  }

  // Vendor three.js minimal files into dist/vendor/three
  try {
    const vendorDir = path.join(distDir, 'vendor', 'three');
    await ensureDir(vendorDir);
    const threeRoot = path.join(rootDir, 'node_modules', 'three');
    const copyPairs = [
      // core build
      ['build/three.min.js', 'build/three.min.js'],
      // loaders
      ['examples/js/loaders/GLTFLoader.js', 'examples/js/loaders/GLTFLoader.js'],
      ['examples/js/loaders/DRACOLoader.js', 'examples/js/loaders/DRACOLoader.js'],
      // draco decoders (js/wasm)
      ['examples/js/libs/draco/draco_decoder.js', 'examples/js/libs/draco/draco_decoder.js'],
      ['examples/js/libs/draco/draco_decoder.wasm', 'examples/js/libs/draco/draco_decoder.wasm'],
      ['examples/js/libs/draco/draco_wasm_wrapper.js', 'examples/js/libs/draco/draco_wasm_wrapper.js'],
      ['examples/js/libs/draco/draco_encoder.wasm', 'examples/js/libs/draco/draco_encoder.wasm'],
      ['examples/js/libs/draco/draco_encoder.js', 'examples/js/libs/draco/draco_encoder.js']
    ];
    for (const [srcRel, dstRel] of copyPairs) {
      const src = path.join(threeRoot, srcRel);
      const dst = path.join(vendorDir, dstRel);
      if (fs.existsSync(src)) {
        await copyRecursive(src, dst);
      }
    }
  } catch (e) {
    console.warn('Warning: Failed to vendor three.js files:', e.message);
  }

  // Rewrite and place index.html into dist/
  await rewriteIndexHtml(rootDir, distDir);

  // Copy finale-threejs.html into dist/
  const finaleSrc = path.join(rootDir, 'finale-threejs.html');
  if (fs.existsSync(finaleSrc)) {
    await copyRecursive(finaleSrc, path.join(distDir, 'finale-threejs.html'));
  }

  // Log summary
  console.log('Prepared dist/ for static hosting:');
  console.log(' - Copied plugin/ and assets/ into dist/');
  console.log(' - Wrote dist/index.html with rewritten asset paths');
  console.log(' - Copied finale-threejs.html into dist/');
  console.log(' - Vendored three.js runtime to dist/vendor/three');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


