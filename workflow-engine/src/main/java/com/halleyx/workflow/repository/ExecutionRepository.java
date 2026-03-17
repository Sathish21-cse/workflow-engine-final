package com.halleyx.workflow.repository;

import com.halleyx.workflow.model.Execution;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExecutionRepository extends JpaRepository<Execution, String> {
    Page<Execution> findByWorkflowIdOrderByStartedAtDesc(String workflowId, Pageable pageable);
    List<Execution> findByWorkflowIdOrderByStartedAtDesc(String workflowId);
    Page<Execution> findAllByOrderByStartedAtDesc(Pageable pageable);
}
