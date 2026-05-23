package com.varify.backend.service;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.RefereeDecisionRequest;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoAnalysisResult;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class RefereeDecisionService {

    private final VideoAnalysisService videoAnalysisService;
    private final RocketRideOrchestrationService orchestrationService;
    private final VarifyModelProperties properties;

    public RefereeDecisionService(
            VideoAnalysisService videoAnalysisService,
            RocketRideOrchestrationService orchestrationService,
            VarifyModelProperties properties
    ) {
        this.videoAnalysisService = videoAnalysisService;
        this.orchestrationService = orchestrationService;
        this.properties = properties;
    }

    public RefereeDecisionResponse decide(Path videoPath, String originalFilename, String contentType, long sizeBytes) {
        VideoAnalysisResult analysis = videoAnalysisService.analyze(videoPath, originalFilename, contentType, sizeBytes);
        RefereeDecisionRequest request = new RefereeDecisionRequest(
                videoPath,
                originalFilename,
                contentType,
                sizeBytes,
                analysis
        );
        Map<String, Object> orchestrationTrace = orchestrationService.orchestrate(analysis);

        Map<String, Object> decisionTrace = new LinkedHashMap<>();
        decisionTrace.put("provider", "gmi");
        decisionTrace.put("mode", hasText(properties.gmi().apiKey()) ? "configured-placeholder" : "mock");
        decisionTrace.put("baseUrl", properties.gmi().baseUrl());
        decisionTrace.put("model", properties.gmi().model());
        decisionTrace.put("requestFile", request.originalFilename() == null ? "upload" : request.originalFilename());

        Map<String, Object> modelTrace = new LinkedHashMap<>();
        modelTrace.put("videoAnalyzer", hasText(properties.gemini().apiKey()) ? "Gemini configured placeholder" : "Gemini mock fallback");
        modelTrace.put("orchestrator", hasText(properties.rocketride().apiKey()) ? "RocketRide configured placeholder" : "RocketRide mock orchestration");
        modelTrace.put("decisionModel", hasText(properties.gmi().apiKey()) ? "Gemma on GMI Cloud configured placeholder" : "Gemma on GMI Cloud mock fallback");
        modelTrace.put("trace", Map.of(
                "videoAnalyzer", analysis.trace(),
                "orchestrator", orchestrationTrace,
                "decisionModel", decisionTrace
        ));

        return new RefereeDecisionResponse(
                "YELLOW_CARD",
                82,
                "00:07-00:09",
                "reckless",
                "The tackle appears reckless because the player arrives late, makes contact with the opponent's lower leg, and does not clearly play the ball. The available evidence does not show excessive force required for a red card.",
                analysis.evidence(),
                analysis.summary(),
                modelTrace
        );
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
