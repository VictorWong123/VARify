package com.varify.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.service.GmiDecisionClient;
import com.varify.backend.service.DecisionResponseParser;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class GmiDecisionClientTest {

    @Test
    void sendsGeminiAnalysisToGmiAndParsesDecisionJson() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        GmiDecisionClient client = new GmiDecisionClient(builder, new ObjectMapper(), new DecisionResponseParser());
        server.expect(once(), requestTo("https://api.gmi-serving.com/v1/chat/completions"))
                .andExpect(header("Authorization", "Bearer gmi-key"))
                .andRespond(withSuccess("""
                        {
                          "choices": [
                            {
                              "message": {
                                "content": "{\\"decision\\":\\"RED_CARD\\",\\"confidence\\":94,\\"ruleCategory\\":\\"serious foul play\\",\\"explanation\\":\\"Excessive force endangers safety.\\",\\"keyMoments\\":[{\\"videoIndex\\":2,\\"timestampSeconds\\":83,\\"description\\":\\"Reverse angle confirms high contact.\\"}],\\"evidence\\":[{\\"videoIndex\\":2,\\"timestampSeconds\\":83,\\"description\\":\\"Studs make high contact.\\"}]}"
                              }
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        RefereeDecisionResponse response = client.decide(
                new VideoAnalysisResult(
                        "Gemini summary",
                        List.of(new EvidenceMoment("01:23", "High contact", 2, "Video 2", 83.0)),
                        Map.of("mode", "live", "structuredAnalysis", Map.of("summary", "Gemini summary"))
                ),
                new VarifyModelProperties.Gmi("gmi-key", "https://api.gmi-serving.com", "gemma-model")
        );

        assertThat(response.decision()).isEqualTo("RED_CARD");
        assertThat(response.keyMoments()).hasSize(1);
        assertThat(response.keyMoments().get(0).timestampSeconds()).isEqualTo(83.0);
        assertThat(response.evidence().get(0).videoIndex()).isEqualTo(2);
        server.verify();
    }
}
