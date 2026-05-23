package com.varify.backend.controller;

import com.varify.backend.dto.ErrorResponse;
import com.varify.backend.exception.AnalysisException;
import com.varify.backend.exception.ModelConfigurationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ModelConfigurationException.class)
    public ResponseEntity<ErrorResponse> handleConfiguration(ModelConfigurationException exception) {
        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(AnalysisException.class)
    public ResponseEntity<ErrorResponse> handleAnalysis(AnalysisException exception) {
        return ResponseEntity
                .status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse(exception.getMessage()));
    }
}
