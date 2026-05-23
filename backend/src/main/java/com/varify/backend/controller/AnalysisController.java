package com.varify.backend.controller;

import com.varify.backend.dto.HealthResponse;
import com.varify.backend.dto.RefereeDecisionResponse;
import com.varify.backend.dto.VideoUpload;
import com.varify.backend.rocketride.RocketRideHealthService;
import com.varify.backend.service.RefereeDecisionService;
import jakarta.validation.constraints.NotNull;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@Validated
public class AnalysisController {

    private final RefereeDecisionService refereeDecisionService;
    private final RocketRideHealthService rocketRideHealthService;

    public AnalysisController(
            RefereeDecisionService refereeDecisionService,
            RocketRideHealthService rocketRideHealthService
    ) {
        this.refereeDecisionService = refereeDecisionService;
        this.rocketRideHealthService = rocketRideHealthService;
    }

    @GetMapping("/health")
    public HealthResponse health() {
        RocketRideHealthService.RocketRideHealthStatus rocketRideStatus = rocketRideHealthService.check();
        return new HealthResponse(
                "ok",
                "varify-backend",
                HealthResponse.RocketRideHealth.from(rocketRideStatus)
        );
    }

    @PostMapping(path = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RefereeDecisionResponse> analyze(
            @RequestParam("video") @NotNull List<MultipartFile> videos
    ) throws IOException {
        if (videos.isEmpty() || videos.stream().anyMatch(MultipartFile::isEmpty)) {
            return ResponseEntity.badRequest().build();
        }

        List<Path> tempFiles = new ArrayList<>();
        try {
            List<VideoUpload> uploads = new ArrayList<>();
            for (int index = 0; index < videos.size(); index++) {
                MultipartFile video = videos.get(index);
                Path tempFile = Files.createTempFile("varify-upload-", suffixFor(video.getOriginalFilename()));
                tempFiles.add(tempFile);
                video.transferTo(tempFile);
                uploads.add(new VideoUpload(
                        tempFile,
                        video.getOriginalFilename(),
                        video.getContentType(),
                        video.getSize(),
                        index + 1
                ));
            }

            RefereeDecisionResponse response = refereeDecisionService.decide(uploads);
            return ResponseEntity.ok(response);
        } finally {
            for (Path tempFile : tempFiles) {
                Files.deleteIfExists(tempFile);
            }
        }
    }

    private static String suffixFor(String filename) {
        if (filename == null || filename.isBlank()) {
            return ".video";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return ".video";
        }
        String suffix = filename.substring(dot).toLowerCase();
        if (suffix.length() > 12 || !suffix.matches("\\.[a-z0-9]+")) {
            return ".video";
        }
        return suffix;
    }
}
