package com.varify.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.exception.AnalysisException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DecisionResponseParser {

    public RefereeDecisionResponse parse(
            JsonNode decision,
            VideoAnalysisResult analysis,
            String decisionModelLabel,
            Map<String, Object> decisionTrace
    ) {
        List<EvidenceMoment> evidence = jsonEvidence(decision.path("evidence"), analysis.evidence());
        List<EvidenceMoment> keyMoments = jsonEvidence(
                decision.path("keyMoments"),
                evidence.isEmpty() ? analysis.evidence() : evidence
        );
        List<String> keyTimestamps = keyMoments.stream().map(EvidenceMoment::timestamp).toList();
        String keyTimestamp = keyTimestamps.isEmpty() ? "" : keyTimestamps.get(0);

        Map<String, Object> modelTrace = new LinkedHashMap<>();
        modelTrace.put("videoAnalyzer", "Gemini live analysis");
        modelTrace.put("decisionModel", decisionModelLabel);
        modelTrace.put("trace", Map.of(
                "videoAnalyzer", analysis.trace(),
                "decisionModel", decisionTrace
        ));

        return new RefereeDecisionResponse(
                requiredDecision(decision, "decision"),
                decision.path("confidence").asDouble(0),
                keyTimestamp,
                keyTimestamps,
                keyMoments,
                requiredText(decision, "ruleCategory"),
                requiredText(decision, "explanation"),
                evidence.isEmpty() ? analysis.evidence() : evidence,
                analysis.summary(),
                modelTrace
        );
    }

    public RefereeDecisionResponse parseRocketRideDecision(JsonNode decision, VideoAnalysisResult analysis) {
        Map<String, Object> decisionTrace = new LinkedHashMap<>();
        decisionTrace.put("provider", "rocketride");
        decisionTrace.put("mode", "pipeline");
        decisionTrace.put("pipeline", "referee-decision-advanced");

        Map<String, Object> trace = new LinkedHashMap<>(analysis.trace());
        trace.put("orchestrator", "RocketRide Orchestration");

        VideoAnalysisResult traceAnalysis = new VideoAnalysisResult(analysis.summary(), analysis.evidence(), trace);
        RefereeDecisionResponse response = parse(
                decision,
                traceAnalysis,
                "RocketRide pipeline decision",
                decisionTrace
        );

        Map<String, Object> modelTrace = new LinkedHashMap<>(response.modelTrace());
        modelTrace.put("orchestrator", "RocketRide Orchestration");
        return new RefereeDecisionResponse(
                response.decision(),
                response.confidence(),
                response.keyTimestamp(),
                response.keyTimestamps(),
                response.keyMoments(),
                response.ruleCategory(),
                response.explanation(),
                response.evidence(),
                response.geminiSummary(),
                modelTrace
        );
    }

    private static List<EvidenceMoment> jsonEvidence(JsonNode items, List<EvidenceMoment> fallback) {
        if (!items.isArray()) {
            return fallback;
        }

        List<EvidenceMoment> evidence = new ArrayList<>();
        for (JsonNode item : items) {
            int videoIndex = item.path("videoIndex").asInt(1);
            double seconds = item.path("timestampSeconds").asDouble(0);
            evidence.add(new EvidenceMoment(
                    formatSeconds(seconds),
                    item.path("description").asText("Model returned an evidence moment without a description."),
                    videoIndex,
                    "Video " + videoIndex,
                    seconds
            ));
        }
        return evidence;
    }

    private static String requiredDecision(JsonNode node, String field) {
        String value = requiredText(node, field).trim().toUpperCase();
        if (!value.equals("RED_CARD") && !value.equals("YELLOW_CARD") && !value.equals("NO_CARD")) {
            throw new AnalysisException(
                    "Decision failed: invalid decision `" + value + "`. Expected RED_CARD, YELLOW_CARD, or NO_CARD."
            );
        }
        return value;
    }

    private static String requiredText(JsonNode node, String field) {
        String value = node.path(field).asText();
        if (value.isBlank()) {
            throw new AnalysisException("Decision failed: missing field `" + field + "`.");
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
}
