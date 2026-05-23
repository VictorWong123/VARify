package com.varify.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.service.DecisionResponseParser;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DecisionResponseParserTest {

    private final DecisionResponseParser parser = new DecisionResponseParser();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parsesRocketRideDecisionWithOrchestratorTrace() throws Exception {
        VideoAnalysisResult analysis = new VideoAnalysisResult(
                "Gemini summary",
                List.of(new EvidenceMoment("01:23", "High contact", 1, "Video 1", 83.0)),
                Map.of("mode", "live")
        );

        RefereeDecisionResponse response = parser.parseRocketRideDecision(
                objectMapper.readTree("""
                        {
                          "decision": "RED_CARD",
                          "confidence": 94,
                          "ruleCategory": "serious foul play",
                          "explanation": "Excessive force endangers safety.",
                          "keyMoments": [
                            {"videoIndex": 1, "timestampSeconds": 83, "description": "High contact"}
                          ],
                          "evidence": [
                            {"videoIndex": 1, "timestampSeconds": 83, "description": "Studs make contact"}
                          ]
                        }
                        """),
                analysis
        );

        assertThat(response.decision()).isEqualTo("RED_CARD");
        assertThat(response.modelTrace().get("orchestrator")).isEqualTo("RocketRide Orchestration");
        assertThat(response.modelTrace().get("decisionModel")).isEqualTo("RocketRide pipeline decision");
    }

    @Test
    void rejectsInvalidDecisionValues() throws Exception {
        VideoAnalysisResult analysis = new VideoAnalysisResult(
                "Gemini summary",
                List.of(),
                Map.of("mode", "live")
        );

        assertThatThrownBy(() -> parser.parseRocketRideDecision(
                objectMapper.readTree("""
                        {
                          "decision": "PENALTY",
                          "confidence": 50,
                          "ruleCategory": "handling",
                          "explanation": "Invalid decision label."
                        }
                        """),
                analysis
        )).isInstanceOf(com.varify.backend.exception.AnalysisException.class)
                .hasMessageContaining("invalid decision");
    }
}
