package com.varify.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.varify.backend.exception.AnalysisException;
import com.varify.backend.rocketride.RocketRideBridgeSupport;
import org.junit.jupiter.api.Test;

class RocketRideBridgeSupportTest {

    @Test
    void summarizeStderrTruncatesLongMessages() {
        String stderr = "x".repeat(600);

        String summary = RocketRideBridgeSupport.summarizeStderr(stderr);

        assertThat(summary).hasSize(503);
        assertThat(summary).endsWith("...");
    }

    @Test
    void ensureSuccessfulIncludesStderrOnFailure() {
        RocketRideBridgeSupport.ProcessResult result = new RocketRideBridgeSupport.ProcessResult(
                1,
                "",
                "pipeline import failed"
        );

        assertThatThrownBy(() -> RocketRideBridgeSupport.ensureSuccessful(result, "RocketRide health check"))
                .isInstanceOf(AnalysisException.class)
                .hasMessageContaining("exit code 1")
                .hasMessageContaining("pipeline import failed");
    }
}
