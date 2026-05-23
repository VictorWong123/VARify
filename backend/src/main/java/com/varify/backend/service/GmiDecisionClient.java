package com.varify.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.exception.AnalysisException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class GmiDecisionClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public GmiDecisionClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClient = restClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public RefereeDecisionResponse decide(VideoAnalysisResult analysis, VarifyModelProperties.Gmi properties) {
        try {
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("model", properties.model());
            request.put("temperature", 0.1);
            request.put("response_format", Map.of("type", "json_object"));
            request.put("messages", List.of(
                    Map.of(
                            "role", "system",
                            "content", refereeSystemPrompt()
                    ),
                    Map.of(
                            "role", "user",
                            "content", "Gemini video analysis JSON:\n" + objectMapper.writeValueAsString(analysis.trace())
                    )
            ));

            JsonNode response = restClient.post()
                    .uri(trimTrailingSlash(properties.baseUrl()) + "/v1/chat/completions")
                    .headers(headers -> headers.setBearerAuth(properties.apiKey()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);

            String content = response.path("choices").path(0).path("message").path("content").asText();
            if (content.isBlank()) {
                throw new AnalysisException("Gemma decision failed: empty response content.");
            }

            JsonNode decision = objectMapper.readTree(content);
            return responseFrom(decision, analysis, properties);
        } catch (RestClientResponseException exception) {
            throw new AnalysisException("Gemma decision failed: " + responseDetail(exception), exception);
        } catch (JsonProcessingException exception) {
            throw new AnalysisException("Gemma decision failed: response was not valid JSON.", exception);
        }
    }

    private RefereeDecisionResponse responseFrom(JsonNode decision, VideoAnalysisResult analysis, VarifyModelProperties.Gmi properties) {
        // Preserve Gemini's key moments (with highlight data) as the primary replay source
        List<EvidenceMoment> keyMoments = analysis.evidence();
        List<EvidenceMoment> evidence = jsonEvidence(decision.path("evidence"), keyMoments);
        List<String> keyTimestamps = keyMoments.stream().map(EvidenceMoment::timestamp).toList();
        String keyTimestamp = keyTimestamps.isEmpty() ? "" : keyTimestamps.get(0);

        Map<String, Object> modelTrace = new LinkedHashMap<>();
        modelTrace.put("videoAnalyzer", "Gemini live analysis");
        modelTrace.put("decisionModel", "Gemma on GMI Cloud live decision");
        modelTrace.put("trace", Map.of(
                "videoAnalyzer", analysis.trace(),
                "decisionModel", Map.of(
                        "provider", "gmi",
                        "mode", "live",
                        "baseUrl", properties.baseUrl(),
                        "model", properties.model()
                )
        ));

        String voiceoverScript = decision.path("voiceover_script").asText(null);
        String finalReason = decision.path("final_reason").asText(null);

        return new RefereeDecisionResponse(
                requiredText(decision, "decision"),
                decision.path("confidence").asDouble(0),
                keyTimestamp,
                keyTimestamps,
                keyMoments,
                requiredText(decision, "ruleCategory"),
                requiredText(decision, "explanation"),
                evidence.isEmpty() ? keyMoments : evidence,
                analysis.summary(),
                modelTrace,
                voiceoverScript,
                finalReason
        );
    }

    private static List<EvidenceMoment> jsonEvidence(JsonNode items, List<EvidenceMoment> fallback) {
        if (!items.isArray()) {
            return fallback;
        }

        List<EvidenceMoment> evidence = new java.util.ArrayList<>();
        for (JsonNode item : items) {
            int videoIndex = item.path("videoIndex").asInt(1);
            double seconds = item.path("timestampSeconds").asDouble(0);
            evidence.add(new EvidenceMoment(
                    formatSeconds(seconds),
                    item.path("description").asText("Model returned an evidence moment without a description."),
                    videoIndex,
                    "Video " + videoIndex,
                    seconds,
                    null,
                    null,
                    null,
                    null
            ));
        }
        return evidence;
    }

    private static String refereeSystemPrompt() {
        return """
                You are a soccer referee decision assistant. Decide whether the incident described by Gemini is RED_CARD, YELLOW_CARD, or NO_CARD.

                Apply Law 12 concepts: careless, reckless, excessive force, serious foul play, violent conduct, point of contact, speed, control, chance to play the ball, and player safety. Use only the provided Gemini structured observations. Do not invent timestamps.

                Return JSON only with these fields:
                - decision: "RED_CARD", "YELLOW_CARD", or "NO_CARD"
                - confidence: number 0-1
                - ruleCategory: "careless", "reckless", "excessive force", or "no offense"
                - explanation: multi-sentence broadcast-style referee brief
                - final_reason: one crisp sentence summarizing the referee ruling (e.g., "The challenge is reckless because the defender arrives late and makes contact with the opponent's leg rather than the ball.")
                - voiceover_script: 2-3 sentence broadcast voiceover explaining the VAR decision. Reference key timestamps. Example: "At four seconds, the defender begins a late challenge. At six seconds, contact is made with the opponent's leg. VARify recommends a yellow card."
                - keyMoments: array of {videoIndex, timestampSeconds, description}
                - evidence: array of {videoIndex, timestampSeconds, description}
                """;
    }

    private static String requiredText(JsonNode node, String field) {
        String value = node.path(field).asText();
        if (value.isBlank()) {
            throw new AnalysisException("Gemma decision failed: missing field `" + field + "`.");
        }
        return value;
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

    private static String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/$", "");
    }

    private static String responseDetail(RestClientResponseException exception) {
        String body = exception.getResponseBodyAsString();
        return body == null || body.isBlank() ? exception.getStatusText() : body;
    }
}
