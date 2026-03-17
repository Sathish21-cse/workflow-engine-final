package com.halleyx.workflow.service;

import com.halleyx.workflow.model.Rule;
import com.halleyx.workflow.model.Step;
import com.halleyx.workflow.model.Workflow;
import com.halleyx.workflow.repository.RuleRepository;
import com.halleyx.workflow.repository.StepRepository;
import com.halleyx.workflow.repository.WorkflowRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private WorkflowRepository workflowRepository;
    @Autowired
    private StepRepository stepRepository;
    @Autowired
    private RuleRepository ruleRepository;

    @Override
    public void run(String... args) throws Exception {
        if (workflowRepository.count() == 0) {
            seedExpenseApproval();
            seedEmployeeOnboarding();
        }
    }

    private void seedExpenseApproval() {
        Workflow wf = new Workflow();
        wf.setName("Expense Approval");
        wf.setIsActive(true);
        wf.setVersion(1);
        wf.setInputSchema("{\"amount\":{\"type\":\"number\",\"required\":true},\"country\":{\"type\":\"string\",\"required\":true},\"department\":{\"type\":\"string\",\"required\":false},\"priority\":{\"type\":\"string\",\"required\":true,\"allowed_values\":[\"High\",\"Medium\",\"Low\"]}}");
        wf = workflowRepository.save(wf);

        // Step 1: Manager Approval
        Step step1 = new Step();
        step1.setWorkflow(wf);
        step1.setWorkflowId(wf.getId());
        step1.setName("Manager Approval");
        step1.setStepType("approval");
        step1.setStepOrder(1);
        step1.setMetadata("{\"assignee_email\":\"manager@example.com\"}");
        step1 = stepRepository.save(step1);

        // Step 2: Finance Notification
        Step step2 = new Step();
        step2.setWorkflow(wf);
        step2.setWorkflowId(wf.getId());
        step2.setName("Finance Notification");
        step2.setStepType("notification");
        step2.setStepOrder(2);
        step2.setMetadata("{\"notification_channel\":\"email\",\"template\":\"Finance team notified\"}");
        step2 = stepRepository.save(step2);

        // Step 3: CEO Approval
        Step step3 = new Step();
        step3.setWorkflow(wf);
        step3.setWorkflowId(wf.getId());
        step3.setName("CEO Approval");
        step3.setStepType("approval");
        step3.setStepOrder(3);
        step3.setMetadata("{\"assignee_email\":\"ceo@example.com\"}");
        step3 = stepRepository.save(step3);

        // Step 4: Task Rejection
        Step step4 = new Step();
        step4.setWorkflow(wf);
        step4.setWorkflowId(wf.getId());
        step4.setName("Task Rejection");
        step4.setStepType("task");
        step4.setStepOrder(4);
        step4.setMetadata("{\"action\":\"reject\"}");
        step4 = stepRepository.save(step4);

        // Set start step
        wf.setStartStepId(step1.getId());
        workflowRepository.save(wf);

        // Rules for Manager Approval (amount >= 100 -> Finance Notification, < 100 -> CEO Approval, DEFAULT -> Task Rejection)
        Rule r1 = new Rule();
        r1.setStep(step1);
        r1.setStepId(step1.getId());
        r1.setConditionExpr("amount >= 100");
        r1.setNextStepId(step2.getId());
        r1.setPriority(1);
        ruleRepository.save(r1);

        Rule r2 = new Rule();
        r2.setStep(step1);
        r2.setStepId(step1.getId());
        r2.setConditionExpr("amount < 100");
        r2.setNextStepId(step3.getId());
        r2.setPriority(2);
        ruleRepository.save(r2);

        Rule r3 = new Rule();
        r3.setStep(step1);
        r3.setStepId(step1.getId());
        r3.setConditionExpr("DEFAULT");
        r3.setNextStepId(step4.getId());
        r3.setPriority(99);
        ruleRepository.save(r3);

        // Rules for Finance Notification -> CEO Approval
        Rule r4 = new Rule();
        r4.setStep(step2);
        r4.setStepId(step2.getId());
        r4.setConditionExpr("amount >= 100");
        r4.setNextStepId(step3.getId());
        r4.setPriority(1);
        ruleRepository.save(r4);

        Rule r5 = new Rule();
        r5.setStep(step2);
        r5.setStepId(step2.getId());
        r5.setConditionExpr("DEFAULT");
        r5.setNextStepId(step3.getId());
        r5.setPriority(99);
        ruleRepository.save(r5);

        // Rules for CEO Approval -> END
        Rule r6 = new Rule();
        r6.setStep(step3);
        r6.setStepId(step3.getId());
        r6.setConditionExpr("DEFAULT");
        r6.setNextStepId(null); // null = workflow ends
        r6.setPriority(1);
        ruleRepository.save(r6);

        // Rules for Task Rejection -> END
        Rule r7 = new Rule();
        r7.setStep(step4);
        r7.setStepId(step4.getId());
        r7.setConditionExpr("DEFAULT");
        r7.setNextStepId(null);
        r7.setPriority(1);
        ruleRepository.save(r7);

        System.out.println("Seeded: Expense Approval workflow");
    }

    private void seedEmployeeOnboarding() {
        Workflow wf = new Workflow();
        wf.setName("Employee Onboarding");
        wf.setIsActive(true);
        wf.setVersion(1);
        wf.setInputSchema("{\"employee_id\":{\"type\":\"string\",\"required\":true},\"department\":{\"type\":\"string\",\"required\":true},\"salary\":{\"type\":\"number\",\"required\":true}}");
        wf = workflowRepository.save(wf);

        Step step1 = new Step();
        step1.setWorkflow(wf);
        step1.setWorkflowId(wf.getId());
        step1.setName("HR Review");
        step1.setStepType("approval");
        step1.setStepOrder(1);
        step1.setMetadata("{\"assignee_email\":\"hr@example.com\"}");
        step1 = stepRepository.save(step1);

        Step step2 = new Step();
        step2.setWorkflow(wf);
        step2.setWorkflowId(wf.getId());
        step2.setName("IT Setup Notification");
        step2.setStepType("notification");
        step2.setStepOrder(2);
        step2.setMetadata("{\"notification_channel\":\"slack\",\"template\":\"IT Setup needed\"}");
        step2 = stepRepository.save(step2);

        wf.setStartStepId(step1.getId());
        workflowRepository.save(wf);

        Rule r1 = new Rule();
        r1.setStep(step1);
        r1.setStepId(step1.getId());
        r1.setConditionExpr("salary >= 50000");
        r1.setNextStepId(step2.getId());
        r1.setPriority(1);
        ruleRepository.save(r1);

        Rule r2 = new Rule();
        r2.setStep(step1);
        r2.setStepId(step1.getId());
        r2.setConditionExpr("DEFAULT");
        r2.setNextStepId(step2.getId());
        r2.setPriority(99);
        ruleRepository.save(r2);

        Rule r3 = new Rule();
        r3.setStep(step2);
        r3.setStepId(step2.getId());
        r3.setConditionExpr("DEFAULT");
        r3.setNextStepId(null);
        r3.setPriority(1);
        ruleRepository.save(r3);

        System.out.println("Seeded: Employee Onboarding workflow");
    }
}
