package com.varify.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.exception.AnalysisException;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class GeminiVideoClient {

    private static final String BASE_URL = "https://generativelanguage.googleapis.com";
    private static final Duration FILE_PROCESSING_TIMEOUT = Duration.ofMinutes(3);
    private static final Duration FILE_PROCESSING_POLL_INTERVAL = Duration.ofSeconds(2);

    private final RestClient restClient;

    public GeminiVideoClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public JsonNode analyze(List<VideoUpload> videos, VarifyModelProperties.Gemini properties) {
        try {
            List<GeminiFile> files = videos.stream()
                    .map(video -> uploadAndWait(video, properties.apiKey()))
                    .toList();

            Map<String, Object> request = new LinkedHashMap<>();
            request.put("contents", List.of(Map.of("parts", partsFor(files))));
            request.put("generationConfig", Map.of(
                    "temperature", 0.1,
                    "responseMimeType", "application/json",
                    "responseSchema", responseSchema()
            ));

            return restClient.post()
                    .uri(BASE_URL + "/v1beta/models/" + properties.model() + ":generateContent")
                    .header("x-goog-api-key", properties.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException exception) {
            throw new AnalysisException("Gemini analysis failed: " + responseDetail(exception), exception);
        }
    }

    private GeminiFile uploadAndWait(VideoUpload video, String apiKey) {
        try {
            byte[] bytes = Files.readAllBytes(video.videoPath());
            String mimeType = contentTypeFor(video);

            ResponseEntity<Void> startResponse = restClient.post()
                    .uri(BASE_URL + "/upload/v1beta/files")
                    .header("x-goog-api-key", apiKey)
                    .header("X-Goog-Upload-Protocol", "resumable")
                    .header("X-Goog-Upload-Command", "start")
                    .header("X-Goog-Upload-Header-Content-Length", Long.toString(bytes.length))
                    .header("X-Goog-Upload-Header-Content-Type", mimeType)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("file", Map.of("display_name", displayNameFor(video))))
                    .retrieve()
                    .toBodilessEntity();

            String uploadUrl = startResponse.getHeaders().getFirst("X-Goog-Upload-URL");
            if (uploadUrl == null || uploadUrl.isBlank()) {
                throw new AnalysisException("Gemini analysis failed: upload URL was not returned.");
            }

            JsonNode uploadResponse = restClient.post()
                    .uri(URI.create(uploadUrl))
                    .header(HttpHeaders.CONTENT_LENGTH, Long.toString(bytes.length))
                    .header("X-Goog-Upload-Offset", "0")
                    .header("X-Goog-Upload-Command", "upload, finalize")
                    .contentType(MediaType.parseMediaType(mimeType))
                    .body(bytes)
                    .retrieve()
                    .body(JsonNode.class);

            GeminiFile file = fileFrom(uploadResponse);
            return waitUntilActive(file, apiKey);
        } catch (RestClientResponseException exception) {
            throw new AnalysisException("Gemini upload failed for " + displayNameFor(video) + ": " + responseDetail(exception), exception);
        } catch (IOException exception) {
            throw new AnalysisException("Gemini upload failed for " + displayNameFor(video) + ": could not read file.", exception);
        }
    }

    private GeminiFile waitUntilActive(GeminiFile file, String apiKey) {
        long deadline = System.nanoTime() + FILE_PROCESSING_TIMEOUT.toNanos();
        GeminiFile current = file;

        while (!"ACTIVE".equalsIgnoreCase(current.state())) {
            if ("FAILED".equalsIgnoreCase(current.state())) {
                throw new AnalysisException("Gemini analysis failed: video file processing failed for " + current.name() + ".");
            }
            if (System.nanoTime() > deadline) {
                throw new AnalysisException("Gemini analysis failed: video file did not become ACTIVE before timeout.");
            }

            try {
                Thread.sleep(FILE_PROCESSING_POLL_INTERVAL.toMillis());
                JsonNode pollResponse = restClient.get()
                        .uri(BASE_URL + "/v1beta/" + current.name())
                        .header("x-goog-api-key", apiKey)
                        .retrieve()
                        .body(JsonNode.class);
                current = fileFrom(pollResponse);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new AnalysisException("Gemini analysis failed: interrupted while waiting for video processing.", exception);
            } catch (RestClientResponseException exception) {
                throw new AnalysisException("Gemini analysis failed while polling uploaded file: " + responseDetail(exception), exception);
            }
        }

        return current;
    }

    private static List<Object> partsFor(List<GeminiFile> files) {
        List<Object> fileParts = files.stream()
                .map(file -> Map.of(
                        "fileData", Map.of(
                                "mimeType", file.mimeType(),
                                "fileUri", file.uri()
                        )
                ))
                .map(Object.class::cast)
                .toList();

        Map<String, Object> promptPart = Map.of("text", """
                Analyze the uploaded soccer incident videos. Each uploaded file is a different angle of the same incident and must be referenced by its 1-based videoIndex in upload order.

                Return only JSON matching the schema. Identify the actual foul/contact incident timestamps. Do not guess timestamps unless the incident truly happens there. If multiple angles show the same incident, include key moments for each relevant angle.

                For each key moment provide:
                - title: short broadcast-style label (e.g., "Late challenge begins")
                - caption: one sentence describing what happened at that moment
                - endSeconds: approximately timestamp_seconds + 1.0 (when this moment ends)
                - highlight: estimate the region of contact as percentages (0-100) of the video frame. Use "circle" for player contact, "box" for tackle/area. If uncertain, place near center-bottom at x:50, y:65, width:20, height:20.
                """);

        java.util.ArrayList<Object> parts = new java.util.ArrayList<>(fileParts);
        parts.add(promptPart);
        return parts;
    }

    private static Map<String, Object> responseSchema() {
        Map<String, Object> highlight = new LinkedHashMap<>();
        highlight.put("type", "OBJECT");
        highlight.put("properties", new LinkedHashMap<>(Map.of(
                "type", Map.of("type", "STRING"),
                "x", Map.of("type", "NUMBER"),
                "y", Map.of("type", "NUMBER"),
                "width", Map.of("type", "NUMBER"),
                "height", Map.of("type", "NUMBER")
        )));

        Map<String, Object> keyMomentProps = new LinkedHashMap<>();
        keyMomentProps.put("videoIndex", Map.of("type", "INTEGER"));
        keyMomentProps.put("timestampSeconds", Map.of("type", "NUMBER"));
        keyMomentProps.put("endSeconds", Map.of("type", "NUMBER"));
        keyMomentProps.put("title", Map.of("type", "STRING"));
        keyMomentProps.put("description", Map.of("type", "STRING"));
        keyMomentProps.put("caption", Map.of("type", "STRING"));
        keyMomentProps.put("confidence", Map.of("type", "NUMBER"));
        keyMomentProps.put("highlight", highlight);

        Map<String, Object> keyMoment = new LinkedHashMap<>();
        keyMoment.put("type", "OBJECT");
        keyMoment.put("required", List.of("videoIndex", "timestampSeconds", "endSeconds", "title", "description", "caption", "confidence"));
        keyMoment.put("properties", keyMomentProps);

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "OBJECT");
        schema.put("required", List.of("summary", "incidentStartSeconds", "incidentEndSeconds", "primaryVideoIndex", "keyMoments", "crossAngleNotes"));
        schema.put("properties", Map.of(
                "summary", Map.of("type", "STRING"),
                "incidentStartSeconds", Map.of("type", "NUMBER"),
                "incidentEndSeconds", Map.of("type", "NUMBER"),
                "primaryVideoIndex", Map.of("type", "INTEGER"),
                "keyMoments", Map.of("type", "ARRAY", "items", keyMoment),
                "crossAngleNotes", Map.of("type", "ARRAY", "items", Map.of("type", "STRING"))
        ));
        return schema;
    }

    private static GeminiFile fileFrom(JsonNode response) {
        JsonNode file = response.has("file") ? response.path("file") : response;
        String name = file.path("name").asText();
        String uri = file.path("uri").asText();
        String mimeType = file.path("mimeType").asText("video/mp4");
        String state = file.path("state").asText("ACTIVE");

        if (name.isBlank() || uri.isBlank()) {
            throw new AnalysisException("Gemini analysis failed: uploaded file response was missing file metadata.");
        }

        return new GeminiFile(name, uri, mimeType, state);
    }

    private static String displayNameFor(VideoUpload video) {
        return video.originalFilename() == null ? video.label() : video.originalFilename();
    }

    private static String contentTypeFor(VideoUpload video) {
        return video.contentType() == null || video.contentType().isBlank()
                ? "video/mp4"
                : video.contentType();
    }

    private static String responseDetail(RestClientResponseException exception) {
        String body = exception.getResponseBodyAsString();
        return body == null || body.isBlank() ? exception.getStatusText() : body;
    }

    private record GeminiFile(String name, String uri, String mimeType, String state) {
    }
}
