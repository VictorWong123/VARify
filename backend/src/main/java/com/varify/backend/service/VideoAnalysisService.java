package com.varify.backend.service;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.dto.EvidenceMoment;
import com.varify.backend.dto.VideoAnalysisResult;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class VideoAnalysisService {

    private final VarifyModelProperties properties;

    public VideoAnalysisService(VarifyModelProperties properties) {
        this.properties = properties;
    }

    public VideoAnalysisResult analyze(Path videoPath, String originalFilename, String contentType, long sizeBytes) {
        boolean geminiConfigured = hasText(properties.gemini().apiKey());
        List<EvidenceMoment> evidence = List.of(
                new EvidenceMoment(
                        "00:07",
                        "Defender arrives late as attacker touches the ball forward."
                ),
                new EvidenceMoment(
                        "00:08",
                        "Contact appears to be made with the opponent's lower leg."
                )
        );

        String mode = geminiConfigured ? "configured-placeholder" : "mock";
        String summary = geminiConfigured
                ? "Gemini video analyzer is configured for external processing; MVP returned a structured placeholder analysis."
                : "Mock analysis: the clip appears to show a late reckless challenge from 00:07 to 00:09 with lower-leg contact and no clear play on the ball.";

        return new VideoAnalysisResult(
                summary,
                evidence,
                Map.of(
                        "provider", "gemini",
                        "mode", mode,
                        "inputFile", originalFilename == null ? "upload" : originalFilename,
                        "contentType", contentType == null ? "application/octet-stream" : contentType,
                        "sizeBytes", sizeBytes,
                        "tempPathReceived", videoPath.getFileName().toString()
                )
        );
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
