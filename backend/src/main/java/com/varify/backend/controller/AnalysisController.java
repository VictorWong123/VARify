package com.varify.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.service.RefereeDecisionService;
import jakarta.validation.constraints.NotNull;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@Validated
public class AnalysisController {

    private final RefereeDecisionService refereeDecisionService;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, Map<String, Object>> replayRequests = new ConcurrentHashMap<>();

    public AnalysisController(RefereeDecisionService refereeDecisionService, ObjectMapper objectMapper) {
        this.refereeDecisionService = refereeDecisionService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "varify-backend");
    }

    @PostMapping(path = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RefereeDecisionResponse> analyze(
            @RequestParam("video") @NotNull List<MultipartFile> videos
    ) throws IOException {
        if (videos.isEmpty() || videos.stream().anyMatch(MultipartFile::isEmpty)) {
            return ResponseEntity.badRequest().build();
        }

        List<Path> tempFiles = new ArrayList<>();
        try {
            List<VideoUpload> uploads = new ArrayList<>();
            for (int index = 0; index < videos.size(); index++) {
                MultipartFile video = videos.get(index);
                Path tempFile = Files.createTempFile("varify-upload-", suffixFor(video.getOriginalFilename()));
                tempFiles.add(tempFile);
                video.transferTo(tempFile);
                uploads.add(new VideoUpload(
                        tempFile,
                        video.getOriginalFilename(),
                        video.getContentType(),
                        video.getSize(),
                        index + 1
                ));
            }

            RefereeDecisionResponse response = refereeDecisionService.decide(uploads);
            return ResponseEntity.ok(response);
        } finally {
            for (Path tempFile : tempFiles) {
                Files.deleteIfExists(tempFile);
            }
        }
    }

    @PostMapping("/replay/generate")
    public ResponseEntity<Map<String, Object>> generateReplay(@RequestBody Map<String, Object> payload) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            String scriptPath = findPythonScript();

            ProcessBuilder pb = new ProcessBuilder("python3", scriptPath);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (OutputStream os = process.getOutputStream()) {
                os.write(jsonPayload.getBytes(StandardCharsets.UTF_8));
            }

            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                return ResponseEntity.status(500).body(Map.of("error", output.isBlank() ? "Python helper failed" : output));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(output, Map.class);
            String requestId = (String) result.getOrDefault("request_id", "unknown");

            Map<String, Object> entry = new HashMap<>(result);
            entry.put("status", "processing");
            replayRequests.put(requestId, entry);

            return ResponseEntity.ok(Map.of("status", "processing", "request_id", requestId));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(503).body(Map.of("error", "Replay generation interrupted"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Replay generation unavailable: " + e.getMessage()));
        }
    }

    @GetMapping("/replay/generate/{requestId}")
    public ResponseEntity<Map<String, Object>> getReplayStatus(@PathVariable String requestId) {
        Map<String, Object> entry = replayRequests.get(requestId);
        if (entry == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(entry);
    }

    private static String findPythonScript() {
        // Look for gmi_video_replay.py relative to common locations
        String[] candidates = {
            "gmi_video_replay.py",
            "../gmi_video_replay.py",
            System.getProperty("user.home") + "/Downloads/VARify/gmi_video_replay.py"
        };
        for (String candidate : candidates) {
            if (new java.io.File(candidate).exists()) {
                return candidate;
            }
        }
        return "gmi_video_replay.py";
    }

    /**
     * POST /api/clips
     * Body: multipart — video (file) + segments (JSON string, e.g. [{"start":14.8,"end":17.2}])
     * Returns: the trimmed video as video/mp4
     *
     * Calls video_clipper.mjs (Node.js) which uses FFmpeg to cut the key segments and
     * stitches them together. The clipper also sends the result through the RocketRide
     * video_clip.pipe pipeline when ROCKETRIDE_API_KEY is configured.
     */
    @PostMapping(path = "/clips", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createClip(
            @RequestParam("video") @NotNull MultipartFile video,
            @RequestParam("segments") String segmentsJson
    ) throws IOException {
        if (video.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "video file is empty"));
        }

        Path tempVideo = Files.createTempFile("varify-clip-input-", suffixFor(video.getOriginalFilename()));
        try {
            video.transferTo(tempVideo);

            String payload = objectMapper.writeValueAsString(Map.of(
                    "video_path", tempVideo.toAbsolutePath().toString(),
                    "segments", objectMapper.readValue(segmentsJson, Object.class)
            ));

            String nodeScript = findNodeScript();
            ProcessBuilder pb = new ProcessBuilder("node", nodeScript);
            pb.environment().putAll(System.getenv());
            pb.redirectErrorStream(false);
            Process process = pb.start();

            try (OutputStream os = process.getOutputStream()) {
                os.write(payload.getBytes(StandardCharsets.UTF_8));
            }

            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            int exit = process.waitFor();

            if (exit != 0) {
                String detail = stderr.isBlank() ? stdout : stderr;
                return ResponseEntity.status(500).contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("error", "clip failed: " + detail.trim()));
            }

            String outputPath = objectMapper.readTree(stdout.trim()).path("output_path").asText();
            if (outputPath.isBlank()) {
                return ResponseEntity.status(500).contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("error", "clipper returned no output_path"));
            }

            Path clipped = Path.of(outputPath);
            byte[] videoBytes = Files.readAllBytes(clipped);

            // Best-effort temp file cleanup
            Files.deleteIfExists(clipped);

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("video/mp4"))
                    .body(videoBytes);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(503).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("error", "clip generation interrupted"));
        } finally {
            Files.deleteIfExists(tempVideo);
        }
    }

    private static String findNodeScript() {
        String[] candidates = {
            "video_clipper.mjs",
            "../video_clipper.mjs",
            System.getProperty("user.home") + "/Downloads/VARify/video_clipper.mjs"
        };
        for (String candidate : candidates) {
            if (new java.io.File(candidate).exists()) {
                return candidate;
            }
        }
        return "video_clipper.mjs";
    }

    private static String suffixFor(String filename) {
        if (filename == null || filename.isBlank()) {
            return ".video";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return ".video";
        }
        String suffix = filename.substring(dot).toLowerCase();
        if (suffix.length() > 12 || !suffix.matches("\\.[a-z0-9]+")) {
            return ".video";
        }
        return suffix;
    }
}
