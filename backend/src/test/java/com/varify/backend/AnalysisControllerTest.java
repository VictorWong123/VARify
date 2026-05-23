package com.varify.backend;

import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "varify.gemini.api-key=",
        "varify.gmi.api-key=",
        "varify.gmi.base-url=https://example.invalid/gmi",
        "varify.gmi.model=test-referee-model",
        "varify.rocketride.api-key="
})
class AnalysisControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthReturnsOk() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("varify-backend"));
    }

    @Test
    void analyzeReturnsStructuredMockDecisionWhenKeysAreMissing() throws Exception {
        MockMultipartFile video = new MockMultipartFile(
                "video",
                "challenge.mp4",
                "video/mp4",
                "fake video bytes".getBytes()
        );

        mockMvc.perform(multipart("/api/analyze").file(video))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("YELLOW_CARD"))
                .andExpect(jsonPath("$.confidence").value(82))
                .andExpect(jsonPath("$.keyTimestamp").value("00:07-00:09"))
                .andExpect(jsonPath("$.ruleCategory").value("reckless"))
                .andExpect(jsonPath("$.explanation").isNotEmpty())
                .andExpect(jsonPath("$.geminiSummary").isNotEmpty())
                .andExpect(jsonPath("$.evidence", hasSize(2)))
                .andExpect(jsonPath("$.evidence[0].timestamp").value("00:07"))
                .andExpect(jsonPath("$.evidence[0].description").isNotEmpty())
                .andExpect(jsonPath("$.modelTrace", hasKey("videoAnalyzer")))
                .andExpect(jsonPath("$.modelTrace", hasKey("orchestrator")))
                .andExpect(jsonPath("$.modelTrace", hasKey("decisionModel")))
                .andExpect(jsonPath("$.modelTrace.trace.videoAnalyzer.mode").value("mock"))
                .andExpect(jsonPath("$.modelTrace.trace.orchestrator.mode").value("mock"))
                .andExpect(jsonPath("$.modelTrace.trace.decisionModel.mode").value("mock"))
                .andExpect(jsonPath("$.modelTrace.trace.decisionModel.model").value("test-referee-model"));
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
}
