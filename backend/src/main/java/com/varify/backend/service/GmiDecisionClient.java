package com.varify.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
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
    private final DecisionResponseParser decisionResponseParser;

    public GmiDecisionClient(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            DecisionResponseParser decisionResponseParser
    ) {
        this.restClient = restClientBuilder.build();
        this.objectMapper = objectMapper;
        this.decisionResponseParser = decisionResponseParser;
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
            Map<String, Object> decisionTrace = Map.of(
                    "provider", "gmi",
                    "mode", "live",
                    "baseUrl", properties.baseUrl(),
                    "model", properties.model()
            );
            return decisionResponseParser.parse(
                    decision,
                    analysis,
                    "Gemma on GMI Cloud live decision",
                    decisionTrace
            );
        } catch (RestClientResponseException exception) {
            throw new AnalysisException("Gemma decision failed: " + responseDetail(exception), exception);
        } catch (JsonProcessingException exception) {
            throw new AnalysisException("Gemma decision failed: response was not valid JSON.", exception);
        }
    }

    private static String refereeSystemPrompt() {
        return """
                You are a soccer referee decision assistant. Decide whether the incident described by Gemini is RED_CARD, YELLOW_CARD, or NO_CARD.

                Apply Law 12 concepts: careless, reckless, excessive force, serious foul play, violent conduct, point of contact, speed, control, chance to play the ball, and player safety. Use only the provided Gemini structured observations. Do not invent timestamps.

                Return JSON only with: decision, confidence, ruleCategory, explanation, keyMoments, evidence. keyMoments and evidence items must include videoIndex, timestampSeconds, and description.
                """;
    }

    private static String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/$", "");
    }

    private static String responseDetail(RestClientResponseException exception) {
        String body = exception.getResponseBodyAsString();
        return body == null || body.isBlank() ? exception.getStatusText() : body;
    }
}
