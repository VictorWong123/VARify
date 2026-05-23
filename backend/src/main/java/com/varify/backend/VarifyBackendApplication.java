package com.varify.backend;

import com.varify.backend.config.VarifyModelProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(VarifyModelProperties.class)
public class VarifyBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(VarifyBackendApplication.class, args);
    }
}
