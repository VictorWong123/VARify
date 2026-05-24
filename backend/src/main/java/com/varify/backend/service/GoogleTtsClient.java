package com.varify.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.exception.AnalysisException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class GoogleTtsClient {

    private static final String TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
    private static final String DEFAULT_VOICE = "en-US-Neural2-D";
    private static final String DEFAULT_LANGUAGE = "en-US";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public GoogleTtsClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClient = restClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    /**
     * Synthesize speech from text and write the result to an MP3 file.
     * Returns the path to the generated audio file.
     */
    public Path synthesize(String text, VarifyModelProperties.Tts properties) {
        if (properties == null || properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new AnalysisException("Google TTS is not configured. Set GOOGLE_TTS_API_KEY.");
        }

        try {
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("input", Map.of("text", text));
            request.put("voice", Map.of(
                    "languageCode", DEFAULT_LANGUAGE,
                    "name", DEFAULT_VOICE
            ));
            request.put("audioConfig", Map.of(
                    "audioEncoding", "MP3",
                    "speakingRate", 0.95,
                    "pitch", -1.0
            ));

            String url = TTS_ENDPOINT + "?key=" + properties.apiKey();

            JsonNode response = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);

            String audioContent = response.path("audioContent").asText();
            if (audioContent.isBlank()) {
                throw new AnalysisException("Google TTS returned empty audio content.");
            }

            byte[] audioBytes = Base64.getDecoder().decode(audioContent);
            Path audioFile = Files.createTempFile("varify-tts-", ".mp3");
            Files.write(audioFile, audioBytes);
            return audioFile;

        } catch (RestClientResponseException e) {
            String body = e.getResponseBodyAsString();
            throw new AnalysisException("Google TTS failed: " + (body.isBlank() ? e.getStatusText() : body), e);
        } catch (AnalysisException e) {
            throw e;
        } catch (Exception e) {
            throw new AnalysisException("Google TTS failed: " + e.getMessage(), e);
        }
    }
}
