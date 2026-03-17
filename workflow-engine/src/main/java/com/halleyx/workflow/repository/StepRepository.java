package com.halleyx.workflow.repository;

import com.halleyx.workflow.model.Step;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StepRepository extends JpaRepository<Step, String> {
    List<Step> findByWorkflowIdOrderByStepOrderAsc(String workflowId);
    void deleteByWorkflowId(String workflowId);
}
