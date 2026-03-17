package com.halleyx.workflow.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "executions")
public class Execution {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "workflow_id", length = 36, nullable = false)
    private String workflowId;

    @Column(name = "workflow_name")
    private String workflowName;

    @Column(name = "workflow_version")
    private Integer workflowVersion;

    @Column(name = "status", nullable = false)
    private String status = "pending"; // pending, in_progress, completed, failed, canceled

    @Column(name = "input_data", columnDefinition = "TEXT")
    private String inputData;

    @Column(name = "logs", columnDefinition = "LONGTEXT")
    private String logs;

    @Column(name = "current_step_id", length = 36)
    private String currentStepId;

    @Column(name = "current_step_name")
    private String currentStepName;

    @Column(name = "retries")
    private Integer retries = 0;

    @Column(name = "triggered_by")
    private String triggeredBy;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @PrePersist
    protected void onCreate() {
        startedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getWorkflowId() { return workflowId; }
    public void setWorkflowId(String workflowId) { this.workflowId = workflowId; }

    public String getWorkflowName() { return workflowName; }
    public void setWorkflowName(String workflowName) { this.workflowName = workflowName; }

    public Integer getWorkflowVersion() { return workflowVersion; }
    public void setWorkflowVersion(Integer workflowVersion) { this.workflowVersion = workflowVersion; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getInputData() { return inputData; }
    public void setInputData(String inputData) { this.inputData = inputData; }

    public String getLogs() { return logs; }
    public void setLogs(String logs) { this.logs = logs; }

    public String getCurrentStepId() { return currentStepId; }
    public void setCurrentStepId(String currentStepId) { this.currentStepId = currentStepId; }

    public String getCurrentStepName() { return currentStepName; }
    public void setCurrentStepName(String currentStepName) { this.currentStepName = currentStepName; }

    public Integer getRetries() { return retries; }
    public void setRetries(Integer retries) { this.retries = retries; }

    public String getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(String triggeredBy) { this.triggeredBy = triggeredBy; }

    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }

    public LocalDateTime getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }
}
