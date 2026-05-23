package com.varify.backend.dto;

import java.nio.file.Path;

public record RefereeDecisionRequest(
        Path videoPath,
        String originalFilename,
        String contentType,
        long sizeBytes,
        VideoAnalysisResult videoAnalysisResult
) {
}
