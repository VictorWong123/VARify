package com.varify.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "varify")
public record VarifyModelProperties(
        Gemini gemini,
        Gmi gmi,
        Tts tts
) {
    public record Gemini(String apiKey, String model) {
    }

    public record Gmi(String apiKey, String baseUrl, String model) {
    }

    public record Tts(String apiKey) {
    }
}
