package com.varify.backend.rocketride;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for RocketRide integration
 */
@Component
@ConfigurationProperties(prefix = "varify.rocketride")
public class RocketRideProperties {
    private String apiKey;
    private String uri;

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }
}
