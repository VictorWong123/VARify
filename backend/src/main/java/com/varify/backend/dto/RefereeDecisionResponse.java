package com.varify.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record RefereeDecisionResponse(
        String decision,
        double confidence,
        String keyTimestamp,
        List<String> keyTimestamps,
        List<EvidenceMoment> keyMoments,
        String ruleCategory,
        String explanation,
        List<EvidenceMoment> evidence,
        String geminiSummary,
        Map<String, Object> modelTrace
) {
    @JsonProperty("decisionSubtitle")
    public String decisionSubtitle() {
        return ruleCategory;
    }

    @JsonProperty("reasoning")
    public String reasoning() {
        return explanation;
    }

    @JsonProperty("timestamps")
    public AnalyzeTimestamps timestamps() {
        String start = firstTimestamp();
        String end = lastTimestamp(start);
        return new AnalyzeTimestamps(start, end, ruleCategory);
    }

    private String firstTimestamp() {
        if (keyTimestamps != null && !keyTimestamps.isEmpty()) {
            return keyTimestamps.get(0);
        }
        return keyTimestamp == null ? "" : keyTimestamp;
    }

    private String lastTimestamp(String fallback) {
        if (keyTimestamps != null && !keyTimestamps.isEmpty()) {
            return keyTimestamps.get(keyTimestamps.size() - 1);
        }
        return fallback;
    }

    public record AnalyzeTimestamps(
            String start,
            String end,
            String label
    ) {
    }

    public static RefereeDecisionResponse fromRawText(String rawText) {
        return new RefereeDecisionResponse(
                "YELLOW_CARD",
                0.6,
                null,
                null,
                null,
                "Pipeline Analysis",
                rawText,
                null,
                null,
                null
        );
    }
}
