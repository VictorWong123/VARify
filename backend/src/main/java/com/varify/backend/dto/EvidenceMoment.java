package com.varify.backend.dto;

public record EvidenceMoment(
        String timestamp,
        String description,
        Integer videoIndex,
        String videoLabel,
        Double timestampSeconds,
        Double endSeconds,
        String title,
        String caption,
        Highlight highlight
) {
    public EvidenceMoment(String timestamp, String description) {
        this(timestamp, description, null, null, null, null, null, null, null);
    }

    public static EvidenceMoment forVideo(
            String timestamp,
            String description,
            VideoUpload videoUpload,
            Double timestampSeconds
    ) {
        return new EvidenceMoment(timestamp, description, videoUpload.videoIndex(), videoUpload.label(), timestampSeconds, null, null, null, null);
    }
}
