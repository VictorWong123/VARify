package com.varify.backend.rocketride;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoAnalysisResult;
import com.varify.backend.exception.AnalysisException;
import com.varify.backend.exception.ModelConfigurationException;
import com.varify.backend.service.DecisionResponseParser;
import jakarta.annotation.PostConstruct;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class RocketRidePipelineService {
    private static final Logger logger = LoggerFactory.getLogger(RocketRidePipelineService.class);

    private final RocketRideProperties rocketRideProperties;
    private final VarifyModelProperties modelProperties;
    private final RocketRideBridgeSupport bridgeSupport;
    private final ObjectMapper objectMapper;
    private final DecisionResponseParser decisionResponseParser;

    public RocketRidePipelineService(
            RocketRideProperties rocketRideProperties,
            VarifyModelProperties modelProperties,
            RocketRideBridgeSupport bridgeSupport,
            ObjectMapper objectMapper,
            DecisionResponseParser decisionResponseParser
    ) {
        this.rocketRideProperties = rocketRideProperties;
        this.modelProperties = modelProperties;
        this.bridgeSupport = bridgeSupport;
        this.objectMapper = objectMapper;
        this.decisionResponseParser = decisionResponseParser;
    }

    @PostConstruct
    void validateWhenEnabled() {
        bridgeSupport.validateWhenEnabled();
    }

    public RefereeDecisionResponse executeRefereeDecisionPipeline(VideoAnalysisResult analysis) {
        requireRocketRideConfig();
        logger.info("Executing RocketRide referee decision pipeline");

        try {
            String inputJson = objectMapper.writeValueAsString(analysis.trace());
            String output = runPythonBridge(inputJson);
            JsonNode decision = objectMapper.readTree(output);
            return decisionResponseParser.parseRocketRideDecision(decision, analysis);
        } catch (JsonProcessingException exception) {
            throw new AnalysisException("RocketRide pipeline failed: response was not valid JSON.", exception);
        }
    }

    private void requireRocketRideConfig() {
        if (!hasText(rocketRideProperties.apiKey())) {
            throw new ModelConfigurationException("RocketRide is not configured. Set ROCKETRIDE_APIKEY.");
        }
        if (!hasText(modelProperties.gmi().apiKey())) {
            throw new ModelConfigurationException("RocketRide pipeline requires GMI_API_KEY for LLM steps.");
        }
        if (!hasText(modelProperties.gmi().model())) {
            throw new ModelConfigurationException("RocketRide pipeline requires GMI_MODEL for LLM steps.");
        }
    }

    private String runPythonBridge(String inputJson) {
        Path pipelinePath = bridgeSupport.resolvePipelinePath();
        Path scriptPath = bridgeSupport.resolveScriptPath();

        List<String> command = new ArrayList<>(bridgeSupport.baseCommand(scriptPath));
        command.add("--pipeline");
        command.add(pipelinePath.toString());
        command.add("--timeout");
        command.add(String.valueOf(rocketRideProperties.timeoutSeconds()));

        RocketRideBridgeSupport.ProcessResult result = bridgeSupport.runProcess(
                command,
                inputJson,
                rocketRideProperties.timeoutSeconds()
        );
        RocketRideBridgeSupport.ensureSuccessful(result, "RocketRide pipeline");
        return result.stdout();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
