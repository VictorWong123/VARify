/**
 * VARify Video Clipper
 *
 * Reads JSON from stdin:  { "video_path": "...", "segments": [{ "start": 14.8, "end": 17.2 }] }
 * Writes JSON to stdout:  { "output_path": "...", "rocketride": true|false }
 *
 * Uses:
 *   - @ffmpeg-installer/ffmpeg + fluent-ffmpeg  — trim and concatenate video segments
 *   - rocketride SDK                            — pipeline transport (video_clip.pipe)
 */

import { RocketRideClient } from 'rocketride';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/** Extract a single segment from the source video into a temp mp4 file. */
function extractSegment(inputPath, start, end, outputPath) {
  return new Promise((resolve, reject) => {
    const duration = Math.max(0.5, end - start);
    // Pre-input -ss: fast keyframe seek (O(1) instead of decoding every frame).
    // Stream copy avoids libx264 re-encode entirely — ~20x faster than ultrafast.
    // A ±1-2 frame imprecision at the keyframe boundary is acceptable for VAR replay.
    ffmpeg()
      .inputOptions([`-ss ${Math.max(0, start - 0.1)}`])
      .input(inputPath)
      .outputOptions([
        '-c copy',
        `-t ${duration + 0.2}`,
        '-avoid_negative_ts make_zero',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

/** Concatenate a list of video files into one output file. */
function concatenateSegments(segPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const listPath = join(tmpdir(), `varify_list_${randomUUID()}.txt`);
    writeFileSync(listPath, segPaths.map((p) => `file '${p}'`).join('\n'));

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy', '-movflags +faststart'])
      .output(outputPath)
      .on('end', () => {
        try { unlinkSync(listPath); } catch {}
        resolve();
      })
      .on('error', (err) => {
        try { unlinkSync(listPath); } catch {}
        reject(err);
      })
      .run();
  });
}

/**
 * Run at most `limit` async tasks concurrently.
 * `tasks` is an array of zero-argument functions that return Promises.
 * Results are returned in the same order as the input array.
 */
async function withConcurrencyLimit(limit, tasks) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    let settled = false;

    function onFail(err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }

    function onDone(index, value) {
      results[index] = value;
      active--;
      // If everything finished, resolve.
      if (active === 0 && nextIndex === tasks.length) {
        settled = true;
        resolve(results);
        return;
      }
      // Kick off the next task if one is waiting.
      if (nextIndex < tasks.length) {
        startNext();
      }
    }

    function startNext() {
      const index = nextIndex++;
      active++;
      tasks[index]().then(
        (value) => { if (!settled) onDone(index, value); },
        (err)   => { if (!settled) onFail(err); },
      );
    }

    // Seed up to `limit` tasks.
    const seed = Math.min(limit, tasks.length);
    for (let i = 0; i < seed; i++) {
      startNext();
    }
  });
}

/** Trim the video to only the requested segments and merge them. */
async function buildClip(videoPath, segments) {
  const tmp = tmpdir();

  if (segments.length === 0) {
    throw new Error('No segments provided');
  }

  // Cap concurrent FFmpeg processes to 3 to avoid saturating disk I/O.
  const FFMPEG_CONCURRENCY = Math.min(segments.length, 3);

  const tasks = segments.map(({ start, end }) => () => {
    const segOut = join(tmp, `varify_seg_${randomUUID()}.mp4`);
    return extractSegment(videoPath, start, end, segOut).then(() => segOut);
  });

  const segPaths = await withConcurrencyLimit(FFMPEG_CONCURRENCY, tasks);

  if (segPaths.length === 1) {
    return segPaths[0];
  }

  const finalOut = join(tmp, `varify_clip_${randomUUID()}.mp4`);
  await concatenateSegments(segPaths, finalOut);

  for (const p of segPaths) {
    try { unlinkSync(p); } catch {}
  }

  return finalOut;
}

/** Send the clipped video through the RocketRide video_clip.pipe pipeline. */
async function sendThroughRocketRide(clippedPath) {
  const apiKey = process.env.ROCKETRIDE_API_KEY || process.env.ROCKETRIDE_APIKEY;
  const uri = process.env.ROCKETRIDE_URI || 'https://cloud.rocketride.ai';

  if (!apiKey) {
    return { used: false, reason: 'ROCKETRIDE_API_KEY not set' };
  }

  const client = new RocketRideClient({ auth: apiKey, uri });

  try {
    await client.connect();

    const pipeResult = await client.use({
      filepath: join(__dirname, 'video_clip.pipe'),
      useExisting: true,
    });
    const token = pipeResult.token;

    const fileBytes = readFileSync(clippedPath);
    const videoFile = new File([fileBytes], 'clip.mp4', { type: 'video/mp4' });

    await client.sendFiles([{ file: videoFile, mimetype: 'video/mp4' }], token);

    return { used: true, token };
  } catch (err) {
    return { used: false, reason: err.message };
  } finally {
    try { await client.disconnect(); } catch {}
  }
}

/**
 * Await `promise` but give up after `ms` milliseconds.
 * Resolves with the promise's value on time, or rejects with a TimeoutError.
 */
async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout: ${label} did not complete within ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const ROCKETRIDE_TIMEOUT_MS = 30_000;

async function main() {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    process.stderr.write('Failed to read stdin\n');
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stderr.write('Invalid JSON on stdin\n');
    process.exit(1);
  }

  const { video_path, segments } = input;

  if (!video_path || !Array.isArray(segments) || segments.length === 0) {
    process.stderr.write(JSON.stringify({ error: 'Missing video_path or segments' }) + '\n');
    process.exit(1);
  }

  let clippedPath;
  try {
    clippedPath = await buildClip(video_path, segments);
  } catch (err) {
    process.stderr.write(JSON.stringify({ error: err.message }) + '\n');
    process.exit(1);
  }

  // Write the result to stdout immediately — Java's caller reads this line and
  // then calls waitFor(). We must keep the process alive long enough for
  // RocketRide to complete, but we must not block forever.
  process.stdout.write(
    JSON.stringify({ output_path: clippedPath, rocketride: 'pending' }) + '\n',
  );

  // Await RocketRide with a hard 30-second timeout so the process stays alive
  // long enough for the async work to complete, but exits cleanly if the
  // pipeline hangs rather than blocking the Java caller indefinitely.
  try {
    const rrResult = await withTimeout(
      sendThroughRocketRide(clippedPath),
      ROCKETRIDE_TIMEOUT_MS,
      'sendThroughRocketRide',
    );

    if (!rrResult.used) {
      process.stderr.write(
        `[WARN] RocketRide skipped: ${rrResult.reason ?? 'unknown'}\n`,
      );
    } else {
      process.stderr.write(
        `[INFO] RocketRide delivered (token=${rrResult.token})\n`,
      );
    }
  } catch (err) {
    // Timeout or unexpected rejection — non-fatal, clip is already delivered.
    process.stderr.write(`[WARN] RocketRide error (non-fatal): ${err.message}\n`);
  }

  // Explicit exit ensures no stray libuv handles keep the process alive after
  // all work is done (e.g. an open socket inside the RocketRide client).
  process.exit(0);
}

main();
