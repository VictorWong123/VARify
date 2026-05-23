package com.varify.backend.service;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.exception.ModelConfigurationException;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RefereeDecisionService {

    private final VideoAnalysisService videoAnalysisService;
    private final GmiDecisionClient gmiDecisionClient;
    private final VarifyModelProperties properties;

    public RefereeDecisionService(
            VideoAnalysisService videoAnalysisService,
            GmiDecisionClient gmiDecisionClient,
            VarifyModelProperties properties
    ) {
        this.videoAnalysisService = videoAnalysisService;
        this.gmiDecisionClient = gmiDecisionClient;
        this.properties = properties;
    }

    public RefereeDecisionResponse decide(List<VideoUpload> videos) {
        requireGmiConfig();
        VideoAnalysisResult analysis = videoAnalysisService.analyze(videos);
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
