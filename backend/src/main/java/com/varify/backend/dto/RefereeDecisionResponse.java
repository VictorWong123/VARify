package com.varify.backend.dto;

import java.util.List;
import java.util.Map;

public record RefereeDecisionResponse(
        String decision,
        double confidence,
        String keyTimestamp,
        String ruleCategory,
        String explanation,
        List<EvidenceMoment> evidence,
        String geminiSummary,
        Map<String, Object> modelTrace
) {
}
