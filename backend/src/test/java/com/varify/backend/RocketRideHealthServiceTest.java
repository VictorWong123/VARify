package com.varify.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.varify.backend.config.VarifyModelProperties;
import com.varify.backend.rocketride.RocketRideBridgeSupport;
import com.varify.backend.rocketride.RocketRideHealthService;
import com.varify.backend.rocketride.RocketRideProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RocketRideHealthServiceTest {

    @Mock
    private RocketRideProperties rocketRideProperties;

    @Mock
    private RocketRideBridgeSupport bridgeSupport;

    @InjectMocks
    private RocketRideHealthService rocketRideHealthService;

    @Test
    void returnsSkippedWhenRocketRideDisabled() {
        when(rocketRideProperties.enabled()).thenReturn(false);

        RocketRideHealthService.RocketRideHealthStatus status = rocketRideHealthService.check();

        assertThat(status.enabled()).isFalse();
        assertThat(status.bridge()).isEqualTo("skipped");
        assertThat(status.connectivity()).isEqualTo("skipped");
    }
}
