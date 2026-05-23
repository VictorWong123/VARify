package com.varify.backend;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.service.RefereeDecisionService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AnalysisControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RefereeDecisionService refereeDecisionService;

    @Test
    void healthReturnsOk() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("varify-backend"));
    }

    @Test
    void analyzeReturnsStructuredModelDecision() throws Exception {
        when(refereeDecisionService.decide(anyList())).thenReturn(sampleDecision());
        MockMultipartFile video = new MockMultipartFile(
                "video",
                "challenge.mp4",
                "video/mp4",
                "fake video bytes".getBytes()
        );

        mockMvc.perform(multipart("/api/analyze").file(video))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("RED_CARD"))
                .andExpect(jsonPath("$.confidence").value(94))
                .andExpect(jsonPath("$.keyTimestamp").value("01:23"))
                .andExpect(jsonPath("$.keyTimestamps", hasSize(1)))
                .andExpect(jsonPath("$.keyMoments", hasSize(1)))
                .andExpect(jsonPath("$.keyMoments[0].timestampSeconds").value(83))
                .andExpect(jsonPath("$.ruleCategory").value("serious foul play"))
                .andExpect(jsonPath("$.explanation").isNotEmpty())
                .andExpect(jsonPath("$.geminiSummary").isNotEmpty())
                .andExpect(jsonPath("$.evidence", hasSize(1)))
                .andExpect(jsonPath("$.evidence[0].videoIndex").value(1))
                .andExpect(jsonPath("$.modelTrace.trace.videoAnalyzer.mode").value("live"))
                .andExpect(jsonPath("$.modelTrace.trace.decisionModel.mode").value("live"));
    }

    @Test
    void analyzeAcceptsMultipleUploadedAngles() throws Exception {
        when(refereeDecisionService.decide(anyList())).thenReturn(sampleDecision());
        MockMultipartFile wideAngle = new MockMultipartFile(
                "video",
                "wide-angle.mp4",
                "video/mp4",
                "wide angle bytes".getBytes()
        );
        MockMultipartFile closeAngle = new MockMultipartFile(
                "video",
                "close-angle.mp4",
                "video/mp4",
                "close angle bytes".getBytes()
        );

        mockMvc.perform(multipart("/api/analyze").file(wideAngle).file(closeAngle))
                .andExpect(status().isOk());

        verify(refereeDecisionService).decide(argThat(uploads ->
                uploads.size() == 2
                        && uploads.get(0).videoIndex() == 1
                        && uploads.get(1).videoIndex() == 2
                        && "close-angle.mp4".equals(uploads.get(1).originalFilename())
        ));
    }

    @Test
    void analyzeRejectsEmptyUpload() throws Exception {
        MockMultipartFile video = new MockMultipartFile(
                "video",
                "empty.mp4",
                "video/mp4",
                new byte[0]
        );

        mockMvc.perform(multipart("/api/analyze").file(video))
                .andExpect(status().isBadRequest());
    }

    private static RefereeDecisionResponse sampleDecision() {
        EvidenceMoment moment = new EvidenceMoment(
                "01:23",
                "Both angles show high-speed studs contact above the ankle.",
                1,
                "Video 1",
                83.0
        );
        return new RefereeDecisionResponse(
                "RED_CARD",
                94,
                "01:23",
                List.of("01:23"),
                List.of(moment),
                "serious foul play",
                "The challenge endangers player safety with excessive force.",
                List.of(moment),
                "Gemini identified the contact point from multiple angles.",
                Map.of(
                        "trace", Map.of(
                                "videoAnalyzer", Map.of("mode", "live"),
                                "decisionModel", Map.of("mode", "live")
                        )
                )
        );
    }
}
