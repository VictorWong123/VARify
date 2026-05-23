package com.varify.backend.rocketride;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.exception.AnalysisException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

@Component
public class RocketRideBridgeSupport {
    private static final String CLASSPATH_PREFIX = "classpath:";
    private static final long PROCESS_GRACE_SECONDS = 30L;

    private final RocketRideProperties rocketRideProperties;
    private final VarifyModelProperties modelProperties;
    private final ResourceLoader resourceLoader;

    public RocketRideBridgeSupport(
            RocketRideProperties rocketRideProperties,
            VarifyModelProperties modelProperties,
            ResourceLoader resourceLoader
    ) {
        this.rocketRideProperties = rocketRideProperties;
        this.modelProperties = modelProperties;
        this.resourceLoader = resourceLoader;
    }

    public List<String> baseCommand(Path scriptPath) {
        List<String> command = new ArrayList<>();
        command.add(rocketRideProperties.pythonPath());
        command.add(scriptPath.toString());
        return command;
    }

    public void configureEnvironment(ProcessBuilder processBuilder) {
        Map<String, String> environment = processBuilder.environment();
        environment.put("ROCKETRIDE_APIKEY", nullToEmpty(rocketRideProperties.apiKey()));
        environment.put("ROCKETRIDE_URI", rocketRideProperties.uri());
        environment.put("GMI_API_KEY", nullToEmpty(modelProperties.gmi().apiKey()));
        environment.put("GMI_BASE_URL", nullToEmpty(modelProperties.gmi().baseUrl()));
        environment.put("GMI_MODEL", nullToEmpty(modelProperties.gmi().model()));
    }

    public ProcessResult runProcess(List<String> command, String stdin, long timeoutSeconds) {
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        configureEnvironment(processBuilder);
        processBuilder.redirectError(ProcessBuilder.Redirect.PIPE);

        try {
            Process process = processBuilder.start();
            if (stdin != null) {
                try (OutputStream outputStream = process.getOutputStream()) {
                    outputStream.write(stdin.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                process.getOutputStream().close();
            }

            ByteArrayOutputStream stdoutBuffer = new ByteArrayOutputStream();
            ByteArrayOutputStream stderrBuffer = new ByteArrayOutputStream();
            Thread stdoutThread = streamReader(process.getInputStream(), stdoutBuffer);
            Thread stderrThread = streamReader(process.getErrorStream(), stderrBuffer);
            stdoutThread.start();
            stderrThread.start();

            boolean finished = process.waitFor(timeoutSeconds + PROCESS_GRACE_SECONDS, TimeUnit.SECONDS);
            joinQuietly(stdoutThread);
            joinQuietly(stderrThread);

            if (!finished) {
                process.destroyForcibly();
                joinQuietly(stdoutThread);
                joinQuietly(stderrThread);
                throw new AnalysisException(
                        "RocketRide bridge timed out after " + timeoutSeconds + "s. "
                                + summarizeStderr(stderrBuffer.toString(StandardCharsets.UTF_8))
                );
            }

            return new ProcessResult(
                    process.exitValue(),
                    stdoutBuffer.toString(StandardCharsets.UTF_8).trim(),
                    stderrBuffer.toString(StandardCharsets.UTF_8).trim()
            );
        } catch (IOException exception) {
            throw new AnalysisException("RocketRide bridge execution failed: " + exception.getMessage(), exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AnalysisException("RocketRide bridge execution interrupted.", exception);
        }
    }

    public void validateWhenEnabled() {
        if (!rocketRideProperties.enabled()) {
            return;
        }

        if (!hasText(rocketRideProperties.apiKey())) {
            throw new IllegalStateException("ROCKETRIDE_ENABLED=true requires ROCKETRIDE_APIKEY.");
        }
        if (!hasText(modelProperties.gmi().apiKey())) {
            throw new IllegalStateException("ROCKETRIDE_ENABLED=true requires GMI_API_KEY.");
        }
        if (!hasText(modelProperties.gmi().model())) {
            throw new IllegalStateException("ROCKETRIDE_ENABLED=true requires GMI_MODEL.");
        }

        verifyPythonExecutable();
        resolveScriptPath();
        resolvePipelinePath();
    }

    public void verifyPythonExecutable() {
        ProcessResult result = runProcess(
                List.of(rocketRideProperties.pythonPath(), "--version"),
                null,
                10
        );
        if (result.exitCode() != 0) {
            throw new AnalysisException(
                    "Python executable check failed: " + summarizeStderr(result.stderr())
            );
        }
    }

    public Path resolvePipelinePath() {
        String configuredPath = rocketRideProperties.pipelinePath();
        if (configuredPath.startsWith(CLASSPATH_PREFIX)) {
            String resourcePath = configuredPath.substring(CLASSPATH_PREFIX.length());
            Resource resource = resourceLoader.getResource(CLASSPATH_PREFIX + resourcePath);
            if (!resource.exists()) {
                throw new AnalysisException("RocketRide pipeline resource not found: " + configuredPath);
            }

            try {
                Path tempFile = Files.createTempFile("varify-pipeline-", ".pipe");
                tempFile.toFile().deleteOnExit();
                try (InputStream inputStream = resource.getInputStream()) {
                    Files.copy(inputStream, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
                return tempFile;
            } catch (IOException exception) {
                throw new AnalysisException("Failed to load RocketRide pipeline resource.", exception);
            }
        }

        Path path = Path.of(configuredPath);
        if (!Files.exists(path)) {
            throw new AnalysisException("RocketRide pipeline file not found: " + configuredPath);
        }
        return path.toAbsolutePath();
    }

    public Path resolveScriptPath() {
        Path configured = Path.of(rocketRideProperties.scriptPath());
        List<Path> candidates = List.of(
                configured,
                Path.of("backend").resolve(configured),
                Path.of(System.getProperty("user.dir")).resolve(configured)
        );

        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath();
            }
        }

        throw new AnalysisException("RocketRide Python script not found: " + rocketRideProperties.scriptPath());
    }

    public static String summarizeStderr(String stderr) {
        if (stderr == null || stderr.isBlank()) {
            return "";
        }
        String trimmed = stderr.trim();
        if (trimmed.length() <= 500) {
            return trimmed;
        }
        return trimmed.substring(0, 500) + "...";
    }

    public static void ensureSuccessful(ProcessResult result, String action) {
        if (result.exitCode() != 0) {
            throw new AnalysisException(
                    action + " failed with exit code " + result.exitCode() + ". "
                            + summarizeStderr(result.stderr())
            );
        }
        if (result.stdout().isBlank()) {
            throw new AnalysisException(action + " returned empty output.");
        }
    }

    private static Thread streamReader(InputStream inputStream, ByteArrayOutputStream buffer) {
        return new Thread(() -> {
            try {
                inputStream.transferTo(buffer);
            } catch (IOException ignored) {
                // Process may already be terminated.
            }
        });
    }

    private static void joinQuietly(Thread thread) {
        try {
            thread.join(5_000);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    public record ProcessResult(int exitCode, String stdout, String stderr) {
    }
}
