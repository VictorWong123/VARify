package com.varify.backend;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.exception.ModelConfigurationException;
import com.varify.backend.service.GmiDecisionClient;
import com.varify.backend.service.RefereeDecisionService;
import com.varify.backend.service.VideoAnalysisService;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class RefereeDecisionServiceTest {

    @Test
    void failsLoudlyWhenGemmaModelIsNotConfigured() {
        VideoAnalysisService videoAnalysisService = mock(VideoAnalysisService.class);
        GmiDecisionClient gmiDecisionClient = mock(GmiDecisionClient.class);
        RefereeDecisionService service = new RefereeDecisionService(
                videoAnalysisService,
                gmiDecisionClient,
                new VarifyModelProperties(
                        new VarifyModelProperties.Gemini("gemini-key", "gemini-2.5-flash"),
                        new VarifyModelProperties.Gmi("gmi-key", "https://api.gmi-serving.com", "")
                )
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

        verifyNoInteractions(videoAnalysisService, gmiDecisionClient);
    }
}
