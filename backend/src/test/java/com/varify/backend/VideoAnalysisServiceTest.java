package com.varify.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.exception.ModelConfigurationException;
import com.varify.backend.service.GeminiVideoClient;
import com.varify.backend.service.VideoAnalysisService;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class VideoAnalysisServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parsesGeminiStructuredJsonIntoTimestampedEvidence() throws Exception {
        GeminiVideoClient geminiVideoClient = mock(GeminiVideoClient.class);
        VarifyModelProperties properties = new VarifyModelProperties(
                new VarifyModelProperties.Gemini("gemini-key", "gemini-2.5-flash"),
                new VarifyModelProperties.Gmi("gmi-key", "https://api.gmi-serving.com", "gemma-model")
        );
        VideoAnalysisService service = new VideoAnalysisService(properties, geminiVideoClient, objectMapper);
        List<VideoUpload> videos = List.of(new VideoUpload(Path.of("clip.mp4"), "clip.mp4", "video/mp4", 1024, 1));
        when(geminiVideoClient.analyze(videos, properties.gemini())).thenReturn(objectMapper.readTree("""
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          {
                            "text": "{\\"summary\\":\\"Late high contact from the reverse angle.\\",\\"incidentStartSeconds\\":83,\\"incidentEndSeconds\\":86,\\"primaryVideoIndex\\":1,\\"keyMoments\\":[{\\"videoIndex\\":1,\\"timestampSeconds\\":83,\\"description\\":\\"High contact above the ankle.\\",\\"confidence\\":0.91}],\\"crossAngleNotes\\":[\\"Single uploaded angle.\\"]}"
                          }
                        ]
                      }
                    }
                  ]
                }
                """));

        VideoAnalysisResult result = service.analyze(videos);

        assertThat(result.summary()).contains("Late high contact");
        assertThat(result.evidence()).hasSize(1);
        assertThat(result.evidence().get(0).timestamp()).isEqualTo("01:23");
        assertThat(result.evidence().get(0).timestampSeconds()).isEqualTo(83.0);
        assertThat(result.trace()).containsEntry("mode", "live");
    }

    @Test
    void failsLoudlyWhenGeminiKeyIsMissing() {
        GeminiVideoClient geminiVideoClient = mock(GeminiVideoClient.class);
        VideoAnalysisService service = new VideoAnalysisService(
                new VarifyModelProperties(
                        new VarifyModelProperties.Gemini("", "gemini-2.5-flash"),
                        new VarifyModelProperties.Gmi("gmi-key", "https://api.gmi-serving.com", "gemma-model")
                ),
                geminiVideoClient,
                objectMapper
        );

        assertThatThrownBy(() -> service.analyze(List.of(new VideoUpload(
                Path.of("clip.mp4"),
                "clip.mp4",
                "video/mp4",
                1024,
                1
        ))))
                .isInstanceOf(ModelConfigurationException.class)
                .hasMessageContaining("GEMINI_API_KEY");

        verifyNoInteractions(geminiVideoClient);
    }
}
