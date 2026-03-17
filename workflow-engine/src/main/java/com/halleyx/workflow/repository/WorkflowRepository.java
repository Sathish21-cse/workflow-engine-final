package com.halleyx.workflow.repository;

import com.halleyx.workflow.model.Workflow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowRepository extends JpaRepository<Workflow, String> {

    Page<Workflow> findByNameContainingIgnoreCase(String name, Pageable pageable);

    List<Workflow> findByIsActive(Boolean isActive);

    @Query("SELECT w FROM Workflow w WHERE (:name IS NULL OR LOWER(w.name) LIKE LOWER(CONCAT('%', :name, '%')))")
    Page<Workflow> searchWorkflows(@Param("name") String name, Pageable pageable);
}
