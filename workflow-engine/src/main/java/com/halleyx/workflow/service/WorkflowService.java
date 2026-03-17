package com.halleyx.workflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.halleyx.workflow.engine.RuleEngine;
import com.halleyx.workflow.model.*;
import com.halleyx.workflow.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.logging.Logger;

@Service
public class WorkflowService {

    private static final Logger logger = Logger.getLogger(WorkflowService.class.getName());

    @Autowired
    private WorkflowRepository workflowRepository;

    @Autowired
    private StepRepository stepRepository;

    @Autowired
    private RuleRepository ruleRepository;

    @Autowired
    private ExecutionRepository executionRepository;

    @Autowired
    private RuleEngine ruleEngine;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ===================== WORKFLOW CRUD =====================

    public Workflow createWorkflow(Workflow workflow) {
        workflow.setVersion(1);
        workflow.setIsActive(Boolean.TRUE);
        if (workflow.getInputSchema() == null || workflow.getInputSchema().isBlank()) {
            workflow.setInputSchema("{}");
        }
        return workflowRepository.save(workflow);
    }

    public Page<Workflow> listWorkflows(String search, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        if (search != null && !search.isEmpty()) {
            return workflowRepository.searchWorkflows(search, pageRequest);
        }
        return workflowRepository.findAll(pageRequest);
    }

    public Optional<Workflow> getWorkflow(String id) {
        return workflowRepository.findById(id);
    }

    public Workflow getWorkflowWithStepsAndRules(String id) {
        Workflow workflow = workflowRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Workflow not found: " + id));
        List<Step> steps = stepRepository.findByWorkflowIdOrderByStepOrderAsc(id);
        for (Step step : steps) {
            List<Rule> rules = ruleRepository.findByStepIdOrderByPriorityAsc(step.getId());
            step.setRules(rules);
        }
        workflow.setSteps(steps);
        return workflow;
    }

    @Transactional
    public Workflow updateWorkflow(String id, Workflow updated) {
        Workflow existing = workflowRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Workflow not found: " + id));
        if (updated.getName() != null && !updated.getName().isBlank()) {
            existing.setName(updated.getName());
        }
        if (updated.getInputSchema() != null && !updated.getInputSchema().isBlank()) {
            existing.setInputSchema(updated.getInputSchema());
        } else if (updated.getInputSchema() != null) {
            existing.setInputSchema("{}");
        }
        if (updated.getIsActive() != null) {
            existing.setIsActive(updated.getIsActive());
        }
        existing.setVersion(existing.getVersion() + 1);
        return workflowRepository.save(existing);
    }

    @Transactional
    public void deleteWorkflow(String id) {
        List<Step> steps = stepRepository.findByWorkflowIdOrderByStepOrderAsc(id);
        for (Step step : steps) {
            ruleRepository.deleteByStepId(step.getId());
        }
        stepRepository.deleteByWorkflowId(id);
        workflowRepository.deleteById(id);
    }

    public Workflow toggleActive(String id, boolean isActive) {
        Workflow w = workflowRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Workflow not found"));
        w.setIsActive(isActive);
        return workflowRepository.save(w);
    }

    // ===================== STEP CRUD =====================

    public Step addStep(String workflowId, Step step) {
        Workflow workflow = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new RuntimeException("Workflow not found: " + workflowId));
        step.setWorkflow(workflow);
        step.setWorkflowId(workflowId);
        Step saved = stepRepository.save(step);
        // Set as start step if first
        List<Step> existing = stepRepository.findByWorkflowIdOrderByStepOrderAsc(workflowId);
        if (existing.size() == 1) {
            workflow.setStartStepId(saved.getId());
            workflowRepository.save(workflow);
        }
        return saved;
    }

    public List<Step> getStepsForWorkflow(String workflowId) {
        List<Step> steps = stepRepository.findByWorkflowIdOrderByStepOrderAsc(workflowId);
        for (Step step : steps) {
            step.setRules(ruleRepository.findByStepIdOrderByPriorityAsc(step.getId()));
        }
        return steps;
    }

    public Step updateStep(String stepId, Step updated) {
        Step existing = stepRepository.findById(stepId)
                .orElseThrow(() -> new RuntimeException("Step not found: " + stepId));
        existing.setName(updated.getName());
        existing.setStepType(updated.getStepType());
        existing.setStepOrder(updated.getStepOrder());
        existing.setMetadata(updated.getMetadata());
        return stepRepository.save(existing);
    }

    @Transactional
    public void deleteStep(String stepId) {
        ruleRepository.deleteByStepId(stepId);
        stepRepository.deleteById(stepId);
    }

    // ===================== RULE CRUD =====================

    public Rule addRule(String stepId, Rule rule) {
        Step step = stepRepository.findById(stepId)
                .orElseThrow(() -> new RuntimeException("Step not found: " + stepId));
        rule.setStep(step);
        rule.setStepId(stepId);
        return ruleRepository.save(rule);
    }

    public List<Rule> getRulesForStep(String stepId) {
        return ruleRepository.findByStepIdOrderByPriorityAsc(stepId);
    }

    public Rule updateRule(String ruleId, Rule updated) {
        Rule existing = ruleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("Rule not found: " + ruleId));
        existing.setConditionExpr(updated.getConditionExpr());
        existing.setNextStepId(updated.getNextStepId());
        existing.setPriority(updated.getPriority());
        return ruleRepository.save(existing);
    }

    public void deleteRule(String ruleId) {
        ruleRepository.deleteById(ruleId);
    }

    // ===================== EXECUTION =====================

    @Transactional
    public Execution executeWorkflow(String workflowId, Map<String, Object> inputData, String triggeredBy) {
        Workflow workflow = getWorkflowWithStepsAndRules(workflowId);

        if (!workflow.getIsActive()) {
            throw new RuntimeException("Workflow is not active.");
        }

        Execution execution = new Execution();
        execution.setWorkflowId(workflowId);
        execution.setWorkflowName(workflow.getName());
        execution.setWorkflowVersion(workflow.getVersion());
        execution.setStatus("in_progress");
        execution.setTriggeredBy(triggeredBy != null ? triggeredBy : "anonymous");
        try {
            execution.setInputData(objectMapper.writeValueAsString(inputData));
        } catch (Exception e) {
            execution.setInputData("{}");
        }

        List<Map<String, Object>> logs = new ArrayList<>();
        execution = executionRepository.save(execution);

        List<Step> steps = workflow.getSteps();
        if (steps.isEmpty()) {
            execution.setStatus("failed");
            execution.setEndedAt(LocalDateTime.now());
            appendLog(logs, "No steps defined in workflow", "failed", null, null);
            saveLogs(execution, logs);
            return executionRepository.save(execution);
        }

        // Build an ID→Step map from ALL steps in this workflow for reliable lookups
        Map<String, Step> stepMap = new LinkedHashMap<>();
        for (Step s : steps) {
            stepMap.put(s.getId(), s);
        }

        // Start from the designated start step, or first by order
        Step currentStep = (workflow.getStartStepId() != null && stepMap.containsKey(workflow.getStartStepId()))
                ? stepMap.get(workflow.getStartStepId())
                : steps.get(0);

        int maxIterations = 50;
        int iterations = 0;

        while (currentStep != null && iterations < maxIterations) {
            iterations++;
            execution.setCurrentStepId(currentStep.getId());
            execution.setCurrentStepName(currentStep.getName());
            executionRepository.save(execution);

            Map<String, Object> stepLog = new LinkedHashMap<>();
            stepLog.put("step_name", currentStep.getName());
            stepLog.put("step_type", currentStep.getStepType());
            stepLog.put("status", "completed");

            List<Rule> rules = ruleRepository.findByStepIdOrderByPriorityAsc(currentStep.getId());
            List<Map<String, Object>> ruleEvals = new ArrayList<>();
            Rule matchedRule = null;

            for (Rule rule : rules) {
                String cond = rule.getConditionExpr();
                if ("DEFAULT".equalsIgnoreCase(cond.trim())) continue;
                try {
                    boolean result = ruleEngine.evaluateCondition(cond, inputData);
                    Map<String, Object> evalEntry = new LinkedHashMap<>();
                    evalEntry.put("rule", cond);
                    evalEntry.put("result", result);
                    ruleEvals.add(evalEntry);
                    if (result && matchedRule == null) {
                        matchedRule = rule;
                    }
                } catch (Exception e) {
                    Map<String, Object> evalEntry = new LinkedHashMap<>();
                    evalEntry.put("rule", cond);
                    evalEntry.put("result", false);
                    evalEntry.put("error", e.getMessage());
                    ruleEvals.add(evalEntry);
                }
            }

            // Fallback to DEFAULT rule
            if (matchedRule == null) {
                for (Rule rule : rules) {
                    if ("DEFAULT".equalsIgnoreCase(rule.getConditionExpr().trim())) {
                        matchedRule = rule;
                        break;
                    }
                }
            }

            stepLog.put("evaluated_rules", ruleEvals);

            if (matchedRule != null) {
                String nextStepId = matchedRule.getNextStepId();
                if (nextStepId == null || nextStepId.trim().isEmpty()) {
                    stepLog.put("selected_next_step", "END");
                    logs.add(stepLog);
                    break; // workflow complete
                }
                // Resolve next step from map; fallback to DB query if missing
                Step nextStep = stepMap.get(nextStepId);
                if (nextStep == null) {
                    nextStep = stepRepository.findById(nextStepId).orElse(null);
                    if (nextStep != null) stepMap.put(nextStep.getId(), nextStep);
                }
                stepLog.put("selected_next_step", nextStep != null ? nextStep.getName() : "END");
                logs.add(stepLog);
                currentStep = nextStep;
            } else {
                stepLog.put("status", "failed");
                stepLog.put("error_message", "No matching rule and no DEFAULT rule defined for step: " + currentStep.getName());
                logs.add(stepLog);
                execution.setStatus("failed");
                execution.setEndedAt(LocalDateTime.now());
                saveLogs(execution, logs);
                return executionRepository.save(execution);
            }
        }

        execution.setStatus("completed");
        execution.setEndedAt(LocalDateTime.now());
        execution.setCurrentStepId(null);
        execution.setCurrentStepName(null);
        saveLogs(execution, logs);
        return executionRepository.save(execution);
    }

    public Execution getExecution(String id) {
        return executionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Execution not found: " + id));
    }

    public Page<Execution> listExecutions(int page, int size) {
        return executionRepository.findAllByOrderByStartedAtDesc(PageRequest.of(page, size));
    }

    public Execution cancelExecution(String id) {
        Execution execution = getExecution(id);
        if ("in_progress".equals(execution.getStatus()) || "pending".equals(execution.getStatus())) {
            execution.setStatus("canceled");
            execution.setEndedAt(LocalDateTime.now());
            return executionRepository.save(execution);
        }
        throw new RuntimeException("Execution cannot be canceled in current state: " + execution.getStatus());
    }

    public Execution retryExecution(String id) {
        Execution execution = getExecution(id);
        if ("failed".equals(execution.getStatus())) {
            execution.setStatus("in_progress");
            execution.setRetries(execution.getRetries() + 1);
            return executionRepository.save(execution);
        }
        throw new RuntimeException("Only failed executions can be retried.");
    }

    // ===================== HELPERS =====================

    private void appendLog(List<Map<String, Object>> logs, String message, String status,
                           String stepName, String stepType) {
        Map<String, Object> log = new LinkedHashMap<>();
        if (stepName != null) log.put("step_name", stepName);
        if (stepType != null) log.put("step_type", stepType);
        log.put("status", status);
        log.put("message", message);
        logs.add(log);
    }

    private void saveLogs(Execution execution, List<Map<String, Object>> logs) {
        try {
            execution.setLogs(objectMapper.writeValueAsString(logs));
        } catch (Exception e) {
            execution.setLogs("[]");
        }
    }
}
