package com.varify.backend.rocketride;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "varify.rocketride")
public record RocketRideProperties(
        boolean enabled,
        String apiKey,
        String uri,
        String pipelinePath,
        String pythonPath,
        String scriptPath,
        int timeoutSeconds,
        boolean healthPing
) {
    public RocketRideProperties {
        if (uri == null || uri.isBlank()) {
            uri = "https://cloud.rocketride.ai";
        }
        if (pipelinePath == null || pipelinePath.isBlank()) {
            pipelinePath = "classpath:pipelines/referee-decision-advanced.pipe";
        }
        if (pythonPath == null || pythonPath.isBlank()) {
            pythonPath = "python";
        }
        if (scriptPath == null || scriptPath.isBlank()) {
            scriptPath = "scripts/run_rocketride_pipeline.py";
        }
        if (timeoutSeconds <= 0) {
            timeoutSeconds = 120;
        }
    }
}
