package com.varify.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.exception.ModelConfigurationException;
import com.varify.backend.rocketride.RocketRidePipelineService;
import com.varify.backend.rocketride.RocketRideProperties;
import com.varify.backend.service.GmiDecisionClient;
import com.varify.backend.service.RefereeDecisionService;
import com.varify.backend.service.VideoAnalysisService;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RefereeDecisionServiceTest {

    @Test
    void failsLoudlyWhenGemmaModelIsNotConfigured() {
        VideoAnalysisService videoAnalysisService = mock(VideoAnalysisService.class);
        GmiDecisionClient gmiDecisionClient = mock(GmiDecisionClient.class);
        RocketRidePipelineService rocketRidePipelineService = mock(RocketRidePipelineService.class);
        VideoAnalysisResult analysis = sampleAnalysis();
        when(videoAnalysisService.analyze(org.mockito.ArgumentMatchers.anyList())).thenReturn(analysis);

        RefereeDecisionService service = new RefereeDecisionService(
                videoAnalysisService,
                gmiDecisionClient,
                rocketRidePipelineService,
                new VarifyModelProperties(
                        new VarifyModelProperties.Gemini("gemini-key", "gemini-2.5-flash"),
                        new VarifyModelProperties.Gmi("gmi-key", "https://api.gmi-serving.com", "")
                ),
                disabledRocketRide()
        );

        assertThatThrownBy(() -> service.decide(List.of(new VideoUpload(
                Path.of("clip.mp4"),
                "clip.mp4",
                "video/mp4",
                1024,
                1
        ))))
                .isInstanceOf(ModelConfigurationException.class)
                .hasMessageContaining("GMI_MODEL");

        verifyNoInteractions(gmiDecisionClient, rocketRidePipelineService);
    }

    @Test
    void usesRocketRidePipelineWhenEnabled() {
        VideoAnalysisService videoAnalysisService = mock(VideoAnalysisService.class);
        GmiDecisionClient gmiDecisionClient = mock(GmiDecisionClient.class);
        RocketRidePipelineService rocketRidePipelineService = mock(RocketRidePipelineService.class);
        VideoAnalysisResult analysis = sampleAnalysis();
        RefereeDecisionResponse pipelineResponse = new RefereeDecisionResponse(
                "YELLOW_CARD",
                80,
                "01:05",
                List.of("01:05"),
                analysis.evidence(),
                "reckless challenge",
                "Reckless contact without excessive force.",
                analysis.evidence(),
                analysis.summary(),
                Map.of("orchestrator", "RocketRide Orchestration")
        );

        when(videoAnalysisService.analyze(org.mockito.ArgumentMatchers.anyList())).thenReturn(analysis);
        when(rocketRidePipelineService.executeRefereeDecisionPipeline(analysis)).thenReturn(pipelineResponse);

        RefereeDecisionService service = new RefereeDecisionService(
                videoAnalysisService,
                gmiDecisionClient,
                rocketRidePipelineService,
                new VarifyModelProperties(
                        new VarifyModelProperties.Gemini("gemini-key", "gemini-2.5-flash"),
                        new VarifyModelProperties.Gmi("gmi-key", "https://api.gmi-serving.com", "gemma-model")
                ),
                enabledRocketRide()
        );

        RefereeDecisionResponse response = service.decide(List.of(new VideoUpload(
                Path.of("clip.mp4"),
                "clip.mp4",
                "video/mp4",
                1024,
                1
        )));

        assertThat(response.decision()).isEqualTo("YELLOW_CARD");
        verify(rocketRidePipelineService).executeRefereeDecisionPipeline(analysis);
        verifyNoInteractions(gmiDecisionClient);
    }

    private static VideoAnalysisResult sampleAnalysis() {
        return new VideoAnalysisResult(
                "Gemini summary",
                List.of(new EvidenceMoment("01:05", "Late tackle", 1, "Video 1", 65.0)),
                Map.of("mode", "live", "structuredAnalysis", Map.of("summary", "Gemini summary"))
        );
    }

    private static RocketRideProperties disabledRocketRide() {
        return new RocketRideProperties(false, "rr-key", "https://cloud.rocketride.ai", "classpath:pipelines/referee-decision-advanced.pipe", "python", "scripts/run_rocketride_pipeline.py", 120, false);
    }

    private static RocketRideProperties enabledRocketRide() {
        return new RocketRideProperties(true, "rr-key", "https://cloud.rocketride.ai", "classpath:pipelines/referee-decision-advanced.pipe", "python", "scripts/run_rocketride_pipeline.py", 120, false);
    }
}
