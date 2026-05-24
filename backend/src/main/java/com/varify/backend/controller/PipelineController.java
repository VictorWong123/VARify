package com.varify.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.varify.backend.rocketride.RocketRidePipelineService;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pipelines")
public class PipelineController {

    private final RocketRidePipelineService pipelineService;

    public PipelineController(RocketRidePipelineService pipelineService) {
        this.pipelineService = pipelineService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listPipelines() {
        return ResponseEntity.ok(pipelineService.listPipelines());
    }

    @GetMapping("/{name}")
    public ResponseEntity<JsonNode> getPipeline(@PathVariable String name) {
        JsonNode pipeline = pipelineService.getPipelineDefinition(name);
        if (pipeline == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(pipeline);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "configured", pipelineService.isConfigured(),
                "provider", "rocketride"
        ));
    }

    @PostMapping("/execute/referee-decision")
    public ResponseEntity<Object> executeRefereeDecision(@RequestBody Map<String, String> request) {
        String evidence = request.getOrDefault("evidence", "");
        if (evidence.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "evidence field is required"));
        }
        var result = pipelineService.executeRefereeDecisionPipeline(evidence);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/execute/video-analysis")
    public ResponseEntity<Object> executeVideoAnalysis(@RequestBody Map<String, String> request) {
        String metadata = request.getOrDefault("metadata", "");
        if (metadata.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "metadata field is required"));
        }
        String result = pipelineService.executeVideoAnalysisPipeline(metadata);
        return ResponseEntity.ok(Map.of("analysis", result));
    }
}
