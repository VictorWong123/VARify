/**
 * Sanity-check that the clipper environment is set up correctly.
 * Run: node check_clipper.mjs
 */
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('✓ Node.js version:', process.version);

console.log('✓ ffmpeg path:', ffmpegInstaller.path);
if (!existsSync(ffmpegInstaller.path)) {
  console.error('✗ ffmpeg binary not found at expected path');
  process.exit(1);
}
console.log('✓ ffmpeg binary exists');

const pipePath = join(__dirname, 'video_clip.pipe');
if (!existsSync(pipePath)) {
  console.error('✗ video_clip.pipe not found');
  process.exit(1);
}
console.log('✓ video_clip.pipe exists');

const apiKey = process.env.ROCKETRIDE_API_KEY || process.env.ROCKETRIDE_APIKEY || '';
if (!apiKey) {
  console.warn('⚠  ROCKETRIDE_API_KEY not set — RocketRide transport will be skipped, FFmpeg clip still works');
} else {
  console.log('✓ ROCKETRIDE_API_KEY present');
}

console.log('\nAll checks passed. Video clipper is ready.');
