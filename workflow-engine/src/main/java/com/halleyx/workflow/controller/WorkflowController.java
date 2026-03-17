package com.halleyx.workflow.controller;

import com.halleyx.workflow.model.*;
import com.halleyx.workflow.service.WorkflowService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class WorkflowController {

    @Autowired
    private WorkflowService workflowService;

    // ===================== AUTH =====================

    @PostMapping("/auth/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");
        Map<String, Object> response = new HashMap<>();
        if ("admin".equals(username) && "admin123".equals(password)) {
            response.put("success", true);
            response.put("role", "admin");
            response.put("username", "admin");
            return ResponseEntity.ok(response);
        }
        response.put("success", false);
        response.put("message", "Invalid credentials");
        return ResponseEntity.status(401).body(response);
    }

    // ===================== WORKFLOWS =====================

    @PostMapping("/workflows")
    public ResponseEntity<Workflow> createWorkflow(@RequestBody Workflow workflow) {
        return ResponseEntity.ok(workflowService.createWorkflow(workflow));
    }

    @GetMapping("/workflows")
    public ResponseEntity<Map<String, Object>> listWorkflows(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<Workflow> result = workflowService.listWorkflows(search, page, size);
        Map<String, Object> response = new HashMap<>();
        response.put("content", result.getContent());
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        response.put("currentPage", page);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/workflows/{id}")
    public ResponseEntity<Workflow> getWorkflow(@PathVariable String id) {
        Workflow workflow = workflowService.getWorkflowWithStepsAndRules(id);
        return ResponseEntity.ok(workflow);
    }

    @PutMapping("/workflows/{id}")
    public ResponseEntity<Workflow> updateWorkflow(@PathVariable String id, @RequestBody Workflow workflow) {
        return ResponseEntity.ok(workflowService.updateWorkflow(id, workflow));
    }

    @DeleteMapping("/workflows/{id}")
    public ResponseEntity<Map<String, String>> deleteWorkflow(@PathVariable String id) {
        workflowService.deleteWorkflow(id);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Workflow deleted successfully");
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/workflows/{id}/toggle")
    public ResponseEntity<Workflow> toggleWorkflow(@PathVariable String id, @RequestBody Map<String, Boolean> body) {
        return ResponseEntity.ok(workflowService.toggleActive(id, body.get("isActive")));
    }

    // ===================== STEPS =====================

    @PostMapping("/workflows/{workflowId}/steps")
    public ResponseEntity<Step> addStep(@PathVariable String workflowId, @RequestBody Step step) {
        return ResponseEntity.ok(workflowService.addStep(workflowId, step));
    }

    @GetMapping("/workflows/{workflowId}/steps")
    public ResponseEntity<List<Step>> getSteps(@PathVariable String workflowId) {
        return ResponseEntity.ok(workflowService.getStepsForWorkflow(workflowId));
    }

    @PutMapping("/steps/{id}")
    public ResponseEntity<Step> updateStep(@PathVariable String id, @RequestBody Step step) {
        return ResponseEntity.ok(workflowService.updateStep(id, step));
    }

    @DeleteMapping("/steps/{id}")
    public ResponseEntity<Map<String, String>> deleteStep(@PathVariable String id) {
        workflowService.deleteStep(id);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Step deleted successfully");
        return ResponseEntity.ok(response);
    }

    // ===================== RULES =====================

    @PostMapping("/steps/{stepId}/rules")
    public ResponseEntity<Rule> addRule(@PathVariable String stepId, @RequestBody Rule rule) {
        return ResponseEntity.ok(workflowService.addRule(stepId, rule));
    }

    @GetMapping("/steps/{stepId}/rules")
    public ResponseEntity<List<Rule>> getRules(@PathVariable String stepId) {
        return ResponseEntity.ok(workflowService.getRulesForStep(stepId));
    }

    @PutMapping("/rules/{id}")
    public ResponseEntity<Rule> updateRule(@PathVariable String id, @RequestBody Rule rule) {
        return ResponseEntity.ok(workflowService.updateRule(id, rule));
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<Map<String, String>> deleteRule(@PathVariable String id) {
        workflowService.deleteRule(id);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Rule deleted successfully");
        return ResponseEntity.ok(response);
    }

    // ===================== EXECUTION =====================

    @PostMapping("/workflows/{workflowId}/execute")
    public ResponseEntity<Object> executeWorkflow(
            @PathVariable String workflowId,
            @RequestBody Map<String, Object> body) {
        try {
            // Support both {data: {...}, triggeredBy: "..."} and flat {field: value, ...}
            Map<String, Object> inputData;
            Object dataObj = body.get("data");
            if (dataObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> castData = (Map<String, Object>) dataObj;
                inputData = castData;
            } else {
                // flat body — exclude triggeredBy
                inputData = new HashMap<>(body);
                inputData.remove("triggeredBy");
            }
            String triggeredBy = body.containsKey("triggeredBy") ? String.valueOf(body.get("triggeredBy")) : "anonymous";
            Execution execution = workflowService.executeWorkflow(workflowId, inputData, triggeredBy);
            return ResponseEntity.ok(execution);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage() != null ? e.getMessage() : "Execution failed");
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/executions/{id}")
    public ResponseEntity<Execution> getExecution(@PathVariable String id) {
        return ResponseEntity.ok(workflowService.getExecution(id));
    }

    @GetMapping("/executions")
    public ResponseEntity<Map<String, Object>> listExecutions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Execution> result = workflowService.listExecutions(page, size);
        Map<String, Object> response = new HashMap<>();
        response.put("content", result.getContent());
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/executions/{id}/cancel")
    public ResponseEntity<Object> cancelExecution(@PathVariable String id) {
        try {
            return ResponseEntity.ok(workflowService.cancelExecution(id));
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/executions/{id}/retry")
    public ResponseEntity<Object> retryExecution(@PathVariable String id) {
        try {
            return ResponseEntity.ok(workflowService.retryExecution(id));
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
