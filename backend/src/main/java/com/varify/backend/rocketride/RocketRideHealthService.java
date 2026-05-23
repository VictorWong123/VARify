package com.varify.backend.rocketride;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RocketRideHealthService {
    private final RocketRideProperties rocketRideProperties;
    private final RocketRideBridgeSupport bridgeSupport;
    private final ObjectMapper objectMapper;

    public RocketRideHealthService(
            RocketRideProperties rocketRideProperties,
            RocketRideBridgeSupport bridgeSupport,
            ObjectMapper objectMapper
    ) {
        this.rocketRideProperties = rocketRideProperties;
        this.bridgeSupport = bridgeSupport;
        this.objectMapper = objectMapper;
    }

    public RocketRideHealthStatus check() {
        if (!rocketRideProperties.enabled()) {
            return RocketRideHealthStatus.skipped();
        }

        try {
            bridgeSupport.verifyPythonExecutable();
            Path scriptPath = bridgeSupport.resolveScriptPath();
            Path pipelinePath = bridgeSupport.resolvePipelinePath();

            List<String> healthCommand = new ArrayList<>(bridgeSupport.baseCommand(scriptPath));
            healthCommand.add("--health");
            healthCommand.add("--pipeline");
            healthCommand.add(pipelinePath.toString());

            RocketRideBridgeSupport.ProcessResult healthResult = bridgeSupport.runProcess(
                    healthCommand,
                    null,
                    15
            );
            if (healthResult.exitCode() != 0) {
                return RocketRideHealthStatus.failedBridge(
                        RocketRideBridgeSupport.summarizeStderr(healthResult.stderr())
                );
            }

            String connectivity = "skipped";
            String detail = null;
            if (rocketRideProperties.healthPing()) {
                connectivity = checkConnectivity(scriptPath);
                if ("failed".equals(connectivity)) {
                    detail = "RocketRide cloud ping failed.";
                }
            }

            return new RocketRideHealthStatus(true, "ok", connectivity, detail);
        } catch (RuntimeException exception) {
            return RocketRideHealthStatus.failedBridge(exception.getMessage());
        }
    }

    private String checkConnectivity(Path scriptPath) {
        if (!hasText(rocketRideProperties.apiKey())) {
            return "failed";
        }

        List<String> pingCommand = new ArrayList<>(bridgeSupport.baseCommand(scriptPath));
        pingCommand.add("--ping");

        RocketRideBridgeSupport.ProcessResult pingResult = bridgeSupport.runProcess(
                pingCommand,
                null,
                30
        );
        if (pingResult.exitCode() != 0) {
            return "failed";
        }

        try {
            JsonNode payload = objectMapper.readTree(pingResult.stdout());
            return "ok".equals(payload.path("connectivity").asText()) ? "ok" : "failed";
        } catch (Exception exception) {
            return "failed";
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record RocketRideHealthStatus(
            boolean enabled,
            String bridge,
            String connectivity,
            String detail
    ) {
        public static RocketRideHealthStatus skipped() {
            return new RocketRideHealthStatus(false, "skipped", "skipped", null);
        }

        public static RocketRideHealthStatus failedBridge(String detail) {
            return new RocketRideHealthStatus(true, "failed", "skipped", detail);
        }
    }
}
