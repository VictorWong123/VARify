package com.varify.backend.service;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.VideoAnalysisResult;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class RocketRideOrchestrationService {

    private final VarifyModelProperties properties;

    public RocketRideOrchestrationService(VarifyModelProperties properties) {
        this.properties = properties;
    }

    public Map<String, Object> orchestrate(VideoAnalysisResult analysisResult) {
        Map<String, Object> trace = new LinkedHashMap<>();
        trace.put("provider", "rocketride");
        trace.put("mode", hasText(properties.rocketride().apiKey()) ? "configured-placeholder" : "mock");
        trace.put("selectedMoments", analysisResult.evidence().stream().map(evidence -> evidence.timestamp()).toList());
        trace.put("reasoningRoute", "video-analysis-to-referee-decision");
        return trace;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
