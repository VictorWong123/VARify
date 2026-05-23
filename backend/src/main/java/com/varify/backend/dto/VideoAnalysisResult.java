package com.varify.backend.dto;

import java.util.List;
import java.util.Map;

public record VideoAnalysisResult(
        String summary,
        List<EvidenceMoment> evidence,
        Map<String, Object> trace
) {
}
