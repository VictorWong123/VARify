package com.varify.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.exception.AnalysisException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class NarrationScriptService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public NarrationScriptService(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClient = restClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public record ClipWindow(int index, double startSeconds, double endSeconds) {}

    public record NarrationSegment(int clipIndex, String text) {}

    public List<NarrationSegment> generateNarration(
            RefereeDecisionResponse analysis,
            List<ClipWindow> clips,
            VarifyModelProperties.Gmi gmiProperties
    ) {
        try {
            Map<String, Object> payload = buildPayload(analysis, clips);

            Map<String, Object> request = new LinkedHashMap<>();
            request.put("model", gmiProperties.model());
            request.put("temperature", 0.4);
            request.put("max_tokens", 1024);
            request.put("response_format", Map.of("type", "json_object"));
            request.put("messages", List.of(
                    Map.of("role", "system", "content", narrationSystemPrompt()),
                    Map.of("role", "user", "content", objectMapper.writeValueAsString(payload))
            ));

            String url = trimTrailingSlash(gmiProperties.baseUrl()) + "/v1/chat/completions";

            JsonNode response = restClient.post()
                    .uri(url)
                    .headers(h -> h.setBearerAuth(gmiProperties.apiKey()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);

            String content = response.path("choices").path(0).path("message").path("content").asText();
            if (content.isBlank()) {
                throw new AnalysisException("Narration script generation failed: empty response.");
            }

            return parseSegments(content, clips.size());

        } catch (RestClientResponseException e) {
            String body = e.getResponseBodyAsString();
            throw new AnalysisException("Narration script failed: " + (body.isBlank() ? e.getStatusText() : body), e);
        } catch (AnalysisException e) {
            throw e;
        } catch (Exception e) {
            throw new AnalysisException("Narration script failed: " + e.getMessage(), e);
        }
    }

    private Map<String, Object> buildPayload(RefereeDecisionResponse analysis, List<ClipWindow> clips) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("decision", analysis.decision());
        payload.put("confidence", analysis.confidence());
        payload.put("ruleCategory", analysis.ruleCategory());
        payload.put("explanation", analysis.explanation());
        payload.put("geminiSummary", analysis.geminiSummary());

        List<Map<String, Object>> evidenceList = new ArrayList<>();
        for (EvidenceMoment em : analysis.evidence()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timestamp", em.timestamp());
            m.put("description", em.description());
            m.put("timestampSeconds", em.timestampSeconds());
            evidenceList.add(m);
        }
        payload.put("evidence", evidenceList);

        List<Map<String, Object>> clipList = new ArrayList<>();
        for (ClipWindow clip : clips) {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("clipIndex", clip.index());
            c.put("startSeconds", clip.startSeconds());
            c.put("endSeconds", clip.endSeconds());
            c.put("durationSeconds", clip.endSeconds() - clip.startSeconds());
            clipList.add(c);
        }
        payload.put("clips", clipList);

        return payload;
    }

    private List<NarrationSegment> parseSegments(String content, int clipCount) throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(content);
        JsonNode segments = root.path("segments");
        if (!segments.isArray() || segments.isEmpty()) {
            String fullText = root.path("narration").asText(content);
            return List.of(new NarrationSegment(0, fullText));
        }

        List<NarrationSegment> result = new ArrayList<>();
        for (JsonNode seg : segments) {
            int idx = seg.path("clipIndex").asInt(result.size());
            String text = seg.path("text").asText("");
            if (!text.isBlank()) {
                result.add(new NarrationSegment(idx, text));
            }
        }

        if (result.isEmpty()) {
            throw new AnalysisException("Narration script returned no usable segments.");
        }
        return result;
    }

    private static String narrationSystemPrompt() {
        return """
                You are a professional sports broadcast commentator narrating a VAR video review. \
                You will receive a referee decision, evidence moments, and a list of video clips with their timestamps. \
                Write a voiceover script that ADVOCATES for the given decision, presenting the video evidence as supporting it. \
                Even if the decision seems controversial, present the evidence as clearly justifying it. \
                Use authoritative broadcast language. Reference what the viewer would see at each moment. \
                For example: "Here we can clearly see the challenge comes in with excessive force..." \
                \
                Rules: \
                - Write one narration segment per clip. \
                - Each segment should be 2-3 sentences, timed to roughly match the clip duration (about 10 seconds of speech). \
                - Do NOT mention the on-field referee or any disagreement. \
                - Present the decision as the correct and obvious call. \
                - Reference specific visual details from the evidence descriptions. \
                \
                Return JSON only: {"segments": [{"clipIndex": 0, "text": "..."}]}""";
    }

    private static String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/$", "");
    }
}
