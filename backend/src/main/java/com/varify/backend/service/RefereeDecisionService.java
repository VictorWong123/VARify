package com.varify.backend.service;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.exception.ModelConfigurationException;
import com.varify.backend.rocketride.RocketRidePipelineService;
import com.varify.backend.rocketride.RocketRideProperties;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RefereeDecisionService {

    private final VideoAnalysisService videoAnalysisService;
    private final GmiDecisionClient gmiDecisionClient;
    private final RocketRidePipelineService rocketRidePipelineService;
    private final VarifyModelProperties properties;
    private final RocketRideProperties rocketRideProperties;

    public RefereeDecisionService(
            VideoAnalysisService videoAnalysisService,
            GmiDecisionClient gmiDecisionClient,
            RocketRidePipelineService rocketRidePipelineService,
            VarifyModelProperties properties,
            RocketRideProperties rocketRideProperties
    ) {
        this.videoAnalysisService = videoAnalysisService;
        this.gmiDecisionClient = gmiDecisionClient;
        this.rocketRidePipelineService = rocketRidePipelineService;
        this.properties = properties;
        this.rocketRideProperties = rocketRideProperties;
    }

    public RefereeDecisionResponse decide(List<VideoUpload> videos) {
        VideoAnalysisResult analysis = videoAnalysisService.analyze(videos);
        if (rocketRideProperties.enabled()) {
            return rocketRidePipelineService.executeRefereeDecisionPipeline(analysis);
        }

        requireGmiConfig();
        return gmiDecisionClient.decide(analysis, properties.gmi());
    }

    private void requireGmiConfig() {
        if (!hasText(properties.gmi().apiKey())) {
            throw new ModelConfigurationException("Gemma decision model is not configured. Set GMI_API_KEY.");
        }
        if (!hasText(properties.gmi().baseUrl())) {
            throw new ModelConfigurationException("Gemma decision model is not configured. Set GMI_BASE_URL.");
        }
        if (!hasText(properties.gmi().model())) {
            throw new ModelConfigurationException("Gemma decision model is not configured. Set GMI_MODEL.");
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
