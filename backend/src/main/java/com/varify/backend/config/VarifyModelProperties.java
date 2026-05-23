package com.varify.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "varify")
public record VarifyModelProperties(
        Gemini gemini,
        Gmi gmi,
        RocketRide rocketride
) {
    public record Gemini(String apiKey) {
    }

    public record Gmi(String apiKey, String baseUrl, String model) {
    }

    public record RocketRide(String apiKey) {
    }
}
