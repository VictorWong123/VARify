package com.varify.backend.dto;

import java.nio.file.Path;

public record VideoUpload(
        Path videoPath,
        String originalFilename,
        String contentType,
        long sizeBytes,
        int videoIndex
) {
    public String label() {
        return "Video " + videoIndex;
    }
}
