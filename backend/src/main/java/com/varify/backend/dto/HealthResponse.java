package com.varify.backend.dto;

import com.varify.backend.rocketride.RocketRideHealthService;

public record HealthResponse(
        String status,
        String service,
        RocketRideHealth rocketride
) {
    public record RocketRideHealth(
            boolean enabled,
            String bridge,
            String connectivity,
            String detail
    ) {
        public static RocketRideHealth from(RocketRideHealthService.RocketRideHealthStatus status) {
            return new RocketRideHealth(
                    status.enabled(),
                    status.bridge(),
                    status.connectivity(),
                    status.detail()
            );
        }
    }
}
