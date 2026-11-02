// Bundle once, render many QA stills: node script/stills.mjs out/qa 120 340 ...
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
const [outDir, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const browserExecutable = process.env.REMOTION_CHROME || null;
const composition = await selectComposition({ serveUrl, id: 'YouTubeMateDemo', inputProps: { bgm: false }, browserExecutable });
console.log('total frames', composition.durationInFrames);
for (const f of frames) {
  await renderStill({ serveUrl, composition, frame: Number(f), output: `${outDir}/f${String(f).padStart(5, '0')}.jpg`, imageFormat: 'jpeg', jpegQuality: 80, browserExecutable, inputProps: { bgm: false } });
  console.log('still', f);
}
