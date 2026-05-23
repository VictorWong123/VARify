package com.varify.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.exception.AnalysisException;
import com.varify.backend.exception.ModelConfigurationException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class VideoAnalysisService {

    private final VarifyModelProperties properties;
    private final GeminiVideoClient geminiVideoClient;
    private final ObjectMapper objectMapper;

    public VideoAnalysisService(
            VarifyModelProperties properties,
            GeminiVideoClient geminiVideoClient,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.geminiVideoClient = geminiVideoClient;
        this.objectMapper = objectMapper;
    }

    public VideoAnalysisResult analyze(List<VideoUpload> videos) {
        requireGeminiConfig();
        JsonNode analysis = geminiVideoClient.analyze(videos, properties.gemini());
        JsonNode content = analysis.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (content.asText().isBlank()) {
            throw new AnalysisException("Gemini analysis failed: empty structured response.");
        }

        JsonNode structured;
        try {
            structured = objectMapper.readTree(content.asText());
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new AnalysisException("Gemini analysis failed: structured response was not valid JSON.", exception);
        }

        List<EvidenceMoment> evidence = evidenceFor(structured.path("keyMoments"), videos);
        if (evidence.isEmpty()) {
            throw new AnalysisException("Gemini analysis failed: no key moments were returned.");
        }

        return new VideoAnalysisResult(
                structured.path("summary").asText("Gemini returned analysis without a summary."),
                evidence,
                traceFor(structured, videos)
        );
    }

    private void requireGeminiConfig() {
        if (!hasText(properties.gemini().apiKey())) {
            throw new ModelConfigurationException("Gemini analysis is not configured. Set GEMINI_API_KEY.");
        }
        if (!hasText(properties.gemini().model())) {
            throw new ModelConfigurationException("Gemini analysis is not configured. Set GEMINI_MODEL.");
        }
    }

    private static List<EvidenceMoment> evidenceFor(JsonNode keyMoments, List<VideoUpload> videos) {
        if (!keyMoments.isArray()) {
            return List.of();
        }

        List<EvidenceMoment> evidence = new java.util.ArrayList<>();
        for (JsonNode moment : keyMoments) {
            int videoIndex = moment.path("videoIndex").asInt(1);
            VideoUpload video = videoFor(videoIndex, videos);
            double timestampSeconds = moment.path("timestampSeconds").asDouble(0);
            evidence.add(EvidenceMoment.forVideo(
                    formatSeconds(timestampSeconds),
                    moment.path("description").asText("Gemini returned a key moment without a description."),
                    video,
                    timestampSeconds
            ));
        }
        return evidence;
    }

    private static Map<String, Object> traceFor(JsonNode structured, List<VideoUpload> videos) {
        Map<String, Object> trace = new LinkedHashMap<>();
        trace.put("provider", "gemini");
        trace.put("mode", "live");
        trace.put("inputFiles", videos.stream().map(VideoAnalysisService::displayNameFor).toList());
        trace.put("inputs", videos.stream().map(VideoAnalysisService::videoTraceFor).toList());
        trace.put("structuredAnalysis", structured);
        return trace;
    }

    private static Map<String, Object> videoTraceFor(VideoUpload video) {
        Map<String, Object> trace = new LinkedHashMap<>();
        trace.put("videoIndex", video.videoIndex());
        trace.put("label", video.label());
        trace.put("inputFile", displayNameFor(video));
        trace.put("contentType", video.contentType() == null ? "application/octet-stream" : video.contentType());
        trace.put("sizeBytes", video.sizeBytes());
        return trace;
    }

    private static VideoUpload videoFor(int videoIndex, List<VideoUpload> videos) {
        return videos.stream()
                .filter(video -> video.videoIndex() == videoIndex)
                .findFirst()
                .orElse(videos.get(0));
    }

    private static String displayNameFor(VideoUpload video) {
        return video.originalFilename() == null ? video.label() : video.originalFilename();
    }

    private static String formatSeconds(double seconds) {
        int rounded = Math.max(0, (int) Math.round(seconds));
        int hours = rounded / 3600;
        int minutes = (rounded % 3600) / 60;
        int remainingSeconds = rounded % 60;
        if (hours > 0) {
            return String.format("%d:%02d:%02d", hours, minutes, remainingSeconds);
        }
        return String.format("%02d:%02d", minutes, remainingSeconds);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
