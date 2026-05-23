package com.varify.backend.service;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.exception.AnalysisException;
import com.varify.backend.service.NarrationScriptService.ClipWindow;
import com.varify.backend.service.NarrationScriptService.NarrationSegment;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EvidenceVideoService {

    private static final Logger log = LoggerFactory.getLogger(EvidenceVideoService.class);
    private static final long FFMPEG_TIMEOUT_SECONDS = 120;
    private static final double CLIP_PADDING_SECONDS = 5.0;

    private final NarrationScriptService narrationScriptService;
    private final GoogleTtsClient googleTtsClient;
    private final VarifyModelProperties properties;

    public EvidenceVideoService(
            NarrationScriptService narrationScriptService,
            GoogleTtsClient googleTtsClient,
            VarifyModelProperties properties
    ) {
        this.narrationScriptService = narrationScriptService;
        this.googleTtsClient = googleTtsClient;
        this.properties = properties;
    }

    /**
     * Generate an evidence highlight video from the source video and analysis result.
     * Returns the path to the generated MP4 (caller is responsible for cleanup).
     */
    public Path generate(Path sourceVideo, RefereeDecisionResponse analysis) {
        validateConfig();
        String ffmpeg = resolveBinary("ffmpeg");
        String ffprobe = resolveBinary("ffprobe");

        List<Path> tempFiles = new ArrayList<>();
        try {
            double duration = probeDuration(ffprobe, sourceVideo);
            List<ClipWindow> clips = buildClipWindows(analysis.evidence(), duration);

            if (clips.isEmpty()) {
                throw new AnalysisException("No evidence moments with timestamps found for video generation.");
            }

            log.info("Extracting {} clips from source video (duration={}s)", clips.size(), duration);

            List<Path> clipFiles = new ArrayList<>();
            for (ClipWindow clip : clips) {
                Path clipFile = extractClip(ffmpeg, sourceVideo, clip);
                clipFiles.add(clipFile);
                tempFiles.add(clipFile);
            }

            Path combined = concatenateClips(ffmpeg, clipFiles);
            tempFiles.add(combined);

            log.info("Generating narration script via Gemma");
            List<NarrationSegment> segments = narrationScriptService.generateNarration(
                    analysis, clips, properties.gmi()
            );

            String fullNarration = segments.stream()
                    .sorted(Comparator.comparingInt(NarrationSegment::clipIndex))
                    .map(NarrationSegment::text)
                    .reduce((a, b) -> a + " ... " + b)
                    .orElse("");

            log.info("Synthesizing voiceover ({} chars)", fullNarration.length());
            Path audioFile = googleTtsClient.synthesize(fullNarration, properties.tts());
            tempFiles.add(audioFile);

            log.info("Overlaying narration on combined video");
            Path finalVideo = overlayAudio(ffmpeg, combined, audioFile);

            return finalVideo;

        } catch (AnalysisException e) {
            throw e;
        } catch (Exception e) {
            throw new AnalysisException("Evidence video generation failed: " + e.getMessage(), e);
        } finally {
            for (Path temp : tempFiles) {
                try { Files.deleteIfExists(temp); } catch (IOException ignored) {}
            }
        }
    }

    private void validateConfig() {
        if (properties.gmi() == null || properties.gmi().apiKey() == null || properties.gmi().apiKey().isBlank()) {
            throw new AnalysisException("Evidence video requires GMI to be configured. Set GMI_API_KEY.");
        }
        if (properties.tts() == null || properties.tts().apiKey() == null || properties.tts().apiKey().isBlank()) {
            throw new AnalysisException("Evidence video requires TTS to be configured. Set GOOGLE_TTS_API_KEY.");
        }
    }

    List<ClipWindow> buildClipWindows(List<EvidenceMoment> evidence, double videoDuration) {
        List<double[]> rawWindows = evidence.stream()
                .filter(e -> e.timestampSeconds() != null && e.timestampSeconds() > 0)
                .sorted(Comparator.comparingDouble(EvidenceMoment::timestampSeconds))
                .map(e -> {
                    double center = e.timestampSeconds();
                    double start = Math.max(0, center - CLIP_PADDING_SECONDS);
                    double end = Math.min(videoDuration, center + CLIP_PADDING_SECONDS);
                    return new double[]{start, end};
                })
                .toList();

        if (rawWindows.isEmpty()) {
            return List.of();
        }

        List<double[]> merged = new ArrayList<>();
        double[] current = rawWindows.get(0).clone();
        for (int i = 1; i < rawWindows.size(); i++) {
            double[] next = rawWindows.get(i);
            if (next[0] <= current[1]) {
                current[1] = Math.max(current[1], next[1]);
            } else {
                merged.add(current);
                current = next.clone();
            }
        }
        merged.add(current);

        List<ClipWindow> clips = new ArrayList<>();
        for (int i = 0; i < merged.size(); i++) {
            clips.add(new ClipWindow(i, merged.get(i)[0], merged.get(i)[1]));
        }
        return clips;
    }

    private double probeDuration(String ffprobe, Path video) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    ffprobe,
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    video.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes()).trim();
            boolean finished = process.waitFor(30, TimeUnit.SECONDS);

            if (!finished || process.exitValue() != 0) {
                throw new AnalysisException("ffprobe failed to determine video duration: " + output);
            }

            return Double.parseDouble(output);
        } catch (NumberFormatException e) {
            throw new AnalysisException("ffprobe returned invalid duration.");
        } catch (AnalysisException e) {
            throw e;
        } catch (Exception e) {
            throw new AnalysisException("ffprobe failed: " + e.getMessage(), e);
        }
    }

    private Path extractClip(String ffmpeg, Path source, ClipWindow clip) {
        try {
            Path output = Files.createTempFile("varify-clip-" + clip.index() + "-", ".mp4");
            double duration = clip.endSeconds() - clip.startSeconds();

            ProcessBuilder pb = new ProcessBuilder(
                    ffmpeg, "-y",
                    "-ss", String.valueOf(clip.startSeconds()),
                    "-i", source.toAbsolutePath().toString(),
                    "-t", String.valueOf(duration),
                    "-c:v", "libx264", "-preset", "fast",
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    output.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String processOutput = new String(process.getInputStream().readAllBytes());
            boolean finished = process.waitFor(FFMPEG_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new AnalysisException("ffmpeg clip extraction timed out for clip " + clip.index());
            }
            if (process.exitValue() != 0) {
                throw new AnalysisException("ffmpeg clip extraction failed: " + firstLine(processOutput));
            }

            return output;
        } catch (AnalysisException e) {
            throw e;
        } catch (Exception e) {
            throw new AnalysisException("Clip extraction failed: " + e.getMessage(), e);
        }
    }

    private Path concatenateClips(String ffmpeg, List<Path> clipFiles) {
        if (clipFiles.size() == 1) {
            return clipFiles.get(0);
        }

        try {
            Path concatList = Files.createTempFile("varify-concat-", ".txt");
            StringBuilder listContent = new StringBuilder();
            for (Path clip : clipFiles) {
                listContent.append("file '").append(clip.toAbsolutePath()).append("'\n");
            }
            Files.writeString(concatList, listContent.toString());

            Path output = Files.createTempFile("varify-combined-", ".mp4");

            ProcessBuilder pb = new ProcessBuilder(
                    ffmpeg, "-y",
                    "-f", "concat", "-safe", "0",
                    "-i", concatList.toAbsolutePath().toString(),
                    "-c:v", "libx264", "-preset", "fast",
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    output.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String processOutput = new String(process.getInputStream().readAllBytes());
            boolean finished = process.waitFor(FFMPEG_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            Files.deleteIfExists(concatList);

            if (!finished) {
                process.destroyForcibly();
                throw new AnalysisException("ffmpeg concatenation timed out.");
            }
            if (process.exitValue() != 0) {
                throw new AnalysisException("ffmpeg concatenation failed: " + firstLine(processOutput));
            }

            return output;
        } catch (AnalysisException e) {
            throw e;
        } catch (Exception e) {
            throw new AnalysisException("Clip concatenation failed: " + e.getMessage(), e);
        }
    }

    private Path overlayAudio(String ffmpeg, Path video, Path audio) {
        try {
            Path output = Files.createTempFile("varify-evidence-", ".mp4");

            ProcessBuilder pb = new ProcessBuilder(
                    ffmpeg, "-y",
                    "-i", video.toAbsolutePath().toString(),
                    "-i", audio.toAbsolutePath().toString(),
                    "-filter_complex",
                    "[0:a]volume=0.3[orig];[1:a]volume=1.5[narr];[orig][narr]amix=inputs=2:duration=first:dropout_transition=2[aout]",
                    "-map", "0:v",
                    "-map", "[aout]",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    "-shortest",
                    output.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String processOutput = new String(process.getInputStream().readAllBytes());
            boolean finished = process.waitFor(FFMPEG_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new AnalysisException("ffmpeg audio overlay timed out.");
            }
            if (process.exitValue() != 0) {
                throw new AnalysisException("ffmpeg audio overlay failed: " + firstLine(processOutput));
            }

            return output;
        } catch (AnalysisException e) {
            throw e;
        } catch (Exception e) {
            throw new AnalysisException("Audio overlay failed: " + e.getMessage(), e);
        }
    }

    private static String resolveBinary(String name) {
        for (String candidate : new String[]{"/usr/local/bin/" + name, "/opt/homebrew/bin/" + name, name}) {
            try {
                Process p = new ProcessBuilder(candidate, "-version").redirectErrorStream(true).start();
                p.getInputStream().readAllBytes();
                if (p.waitFor(5, TimeUnit.SECONDS) && p.exitValue() == 0) {
                    return candidate;
                }
            } catch (IOException | InterruptedException ignored) {}
        }
        throw new AnalysisException(name + " is not installed. Install it with: brew install " + name);
    }

    private static String firstLine(String output) {
        if (output == null || output.isBlank()) return "unknown error";
        return output.lines().findFirst().orElse("unknown error");
    }
}
