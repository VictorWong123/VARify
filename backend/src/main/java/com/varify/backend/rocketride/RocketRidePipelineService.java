package com.varify.backend.rocketride;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.varify.backend.dto.RefereeDecisionResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class RocketRidePipelineService {
    private static final Logger logger = LoggerFactory.getLogger(RocketRidePipelineService.class);

    private final RocketRideProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public RocketRidePipelineService(
            RocketRideProperties properties,
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder
                .baseUrl(properties.getUri() != null ? properties.getUri() : "https://cloud.rocketride.ai")
                .build();
    }

    public boolean isConfigured() {
        return properties.getApiKey() != null
                && !properties.getApiKey().isBlank()
                && properties.getUri() != null
                && !properties.getUri().isBlank();
    }

    public RefereeDecisionResponse executeRefereeDecisionPipeline(String evidenceText) {
        logger.info("Executing referee decision pipeline via RocketRide");

        JsonNode pipeline = loadPipeline("referee-decision-advanced.pipe");
        if (pipeline == null) {
            pipeline = loadPipeline("referee-decision.pipe");
        }
        if (pipeline == null) {
            throw new IllegalStateException("No referee-decision pipeline found in .rocketride/pipelines/");
        }

        String result = executePipeline(pipeline, evidenceText);
        return parseDecisionResponse(result);
    }

    public String executeVideoAnalysisPipeline(String videoMetadata) {
        logger.info("Executing video analysis pipeline via RocketRide");

        JsonNode pipeline = loadPipeline("video-analysis-multi-step.pipe");
        if (pipeline == null) {
            pipeline = loadPipeline("video-analysis.pipe");
        }
        if (pipeline == null) {
            throw new IllegalStateException("No video-analysis pipeline found in .rocketride/pipelines/");
        }

        return executePipeline(pipeline, videoMetadata);
    }

    public List<Map<String, Object>> listPipelines() {
        Path pipelinesDir = Path.of(".rocketride", "pipelines");
        List<Map<String, Object>> pipelines = new ArrayList<>();

        if (!Files.isDirectory(pipelinesDir)) {
            return pipelines;
        }

        try (var stream = Files.list(pipelinesDir)) {
            stream.filter(p -> p.toString().endsWith(".pipe"))
                    .filter(p -> !p.getFileName().toString().equals("TEMPLATE.pipe"))
                    .forEach(path -> {
                        try {
                            JsonNode node = objectMapper.readTree(path.toFile());
                            String name = path.getFileName().toString().replace(".pipe", "");
                            int componentCount = node.has("components") ? node.get("components").size() : 0;
                            String projectId = node.has("project_id") ? node.get("project_id").asText() : "";

                            pipelines.add(Map.of(
                                    "name", name,
                                    "projectId", projectId,
                                    "componentCount", componentCount,
                                    "components", extractComponentSummaries(node)
                            ));
                        } catch (IOException e) {
                            logger.warn("Failed to read pipeline file: {}", path, e);
                        }
                    });
        } catch (IOException e) {
            logger.warn("Failed to list pipelines directory", e);
        }

        return pipelines;
    }

    public JsonNode getPipelineDefinition(String pipelineName) {
        return loadPipeline(pipelineName + ".pipe");
    }

    private String executePipeline(JsonNode pipeline, String inputData) {
        if (!isConfigured()) {
            logger.warn("RocketRide not configured, returning mock response");
            return mockPipelineResponse(inputData);
        }

        String projectId = pipeline.get("project_id").asText();
        ArrayNode components = (ArrayNode) pipeline.get("components");
        String sourceId = findSourceComponent(components);

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("components", components);
        payload.put("project_id", projectId);
        payload.put("source", sourceId);

        try {
            String startResponse = restClient.post()
                    .uri("/api/v1/pipelines/start")
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .header("Content-Type", "application/json")
                    .body(payload.toString())
                    .retrieve()
                    .body(String.class);

            JsonNode startResult = objectMapper.readTree(startResponse);
            String token = startResult.get("token").asText();

            ObjectNode sendPayload = objectMapper.createObjectNode();
            sendPayload.put("token", token);
            sendPayload.put("data", inputData);

            String sendResponse = restClient.post()
                    .uri("/api/v1/pipelines/send")
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .header("Content-Type", "application/json")
                    .body(sendPayload.toString())
                    .retrieve()
                    .body(String.class);

            JsonNode sendResult = objectMapper.readTree(sendResponse);
            if (sendResult.has("text")) {
                return sendResult.get("text").asText();
            }
            return sendResult.toString();

        } catch (Exception e) {
            logger.error("RocketRide pipeline execution failed, falling back to mock", e);
            return mockPipelineResponse(inputData);
        }
    }

    private JsonNode loadPipeline(String filename) {
        Path path = Path.of(".rocketride", "pipelines", filename);
        if (!Files.isRegularFile(path)) {
            return null;
        }
        try {
            return objectMapper.readTree(path.toFile());
        } catch (IOException e) {
            logger.error("Failed to load pipeline: {}", filename, e);
            return null;
        }
    }

    private String findSourceComponent(ArrayNode components) {
        for (JsonNode comp : components) {
            String provider = comp.get("provider").asText();
            if ("webhook".equals(provider) || "chat".equals(provider) || "dropper".equals(provider)) {
                return comp.get("id").asText();
            }
        }
        return components.get(0).get("id").asText();
    }

    private List<Map<String, String>> extractComponentSummaries(JsonNode pipeline) {
        List<Map<String, String>> summaries = new ArrayList<>();
        if (!pipeline.has("components")) return summaries;
        for (JsonNode comp : pipeline.get("components")) {
            summaries.add(Map.of(
                    "id", comp.get("id").asText(),
                    "provider", comp.get("provider").asText()
            ));
        }
        return summaries;
    }

    private RefereeDecisionResponse parseDecisionResponse(String raw) {
        try {
            return objectMapper.readValue(raw, RefereeDecisionResponse.class);
        } catch (Exception e) {
            logger.warn("Could not parse pipeline output as RefereeDecisionResponse, wrapping raw text");
            return RefereeDecisionResponse.fromRawText(raw);
        }
    }

    private String mockPipelineResponse(String input) {
        return """
                {
                  "decision": "YELLOW_CARD",
                  "confidence": 72,
                  "explanation": "Based on the video analysis, the challenge involved excessive force but was not violent conduct.",
                  "ruleCategory": "Reckless Challenge",
                  "evidence": [{"timestamp": "00:23", "description": "Initial contact with studs showing"}]
                }
                """;
    }
}
