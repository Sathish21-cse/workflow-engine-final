package com.halleyx.workflow.engine;

import com.halleyx.workflow.model.Rule;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

@Component
public class RuleEngine {

    private static final Logger logger = Logger.getLogger(RuleEngine.class.getName());

    /**
     * Evaluates a list of rules against input data.
     * Returns the first matching rule by priority.
     * Returns the DEFAULT rule if none match.
     */
    public Rule evaluate(List<Rule> rules, Map<String, Object> inputData) {
        for (Rule rule : rules) {
            String condition = rule.getConditionExpr();
            if ("DEFAULT".equalsIgnoreCase(condition.trim())) {
                continue; // skip DEFAULT in first pass
            }
            try {
                boolean result = evaluateCondition(condition, inputData);
                logger.info("Rule [" + condition + "] => " + result);
                if (result) {
                    return rule;
                }
            } catch (Exception e) {
                logger.warning("Error evaluating rule: " + condition + " => " + e.getMessage());
            }
        }

        // Fall through to DEFAULT
        for (Rule rule : rules) {
            if ("DEFAULT".equalsIgnoreCase(rule.getConditionExpr().trim())) {
                logger.info("No rule matched, using DEFAULT rule.");
                return rule;
            }
        }

        return null; // No match and no DEFAULT
    }

    /**
     * Evaluate a condition string against input data.
     * Operator precedence: || (lowest) -> && -> comparison/functions (highest)
     * Supports: ==, !=, <, >, <=, >=, &&, ||, contains(), startsWith(), endsWith()
     */
    public boolean evaluateCondition(String condition, Map<String, Object> data) {
        condition = condition.trim();

        // Remove outer parentheses if the whole expression is wrapped
        while (condition.startsWith("(") && condition.endsWith(")") && isWrapped(condition)) {
            condition = condition.substring(1, condition.length() - 1).trim();
        }

        // Handle OR first (lowest precedence — split rightmost to respect left-to-right)
        String[] orParts = splitByTopLevelOperator(condition, "||");
        if (orParts != null) {
            return evaluateCondition(orParts[0], data) || evaluateCondition(orParts[1], data);
        }

        // Handle AND (higher precedence than OR)
        String[] andParts = splitByTopLevelOperator(condition, "&&");
        if (andParts != null) {
            return evaluateCondition(andParts[0], data) && evaluateCondition(andParts[1], data);
        }

        // Handle string functions
        if (condition.startsWith("contains(")) {
            return evaluateContains(condition, data);
        }
        if (condition.startsWith("startsWith(")) {
            return evaluateStartsWith(condition, data);
        }
        if (condition.startsWith("endsWith(")) {
            return evaluateEndsWith(condition, data);
        }

        // Handle comparison operators
        return evaluateComparison(condition, data);
    }

    /** Check if the entire string is wrapped by a matching outer pair of parentheses */
    private boolean isWrapped(String s) {
        int depth = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == '(') depth++;
            else if (s.charAt(i) == ')') {
                depth--;
                if (depth == 0 && i < s.length() - 1) return false;
            }
        }
        return depth == 0;
    }

    /**
     * Split at the LAST occurrence of operator at top level (left-associative).
     * This ensures a && b && c splits as (a && b) && c correctly.
     */
    private String[] splitByTopLevelOperator(String condition, String operator) {
        int parenDepth = 0;
        int opLen = operator.length();
        int lastIndex = -1;
        for (int i = 0; i <= condition.length() - opLen; i++) {
            char c = condition.charAt(i);
            if (c == '(') parenDepth++;
            else if (c == ')') parenDepth--;
            else if (parenDepth == 0 && condition.startsWith(operator, i)) {
                lastIndex = i;
                i += opLen - 1; // skip past operator chars
            }
        }
        if (lastIndex >= 0) {
            return new String[]{
                condition.substring(0, lastIndex).trim(),
                condition.substring(lastIndex + opLen).trim()
            };
        }
        return null;
    }

    private boolean evaluateComparison(String condition, Map<String, Object> data) {
        // Order matters: check multi-char operators before single-char ones
        String[] operators = {"<=", ">=", "!=", "==", "<", ">"};
        for (String op : operators) {
            int idx = findOperatorIndex(condition, op);
            if (idx > 0) {
                String field = condition.substring(0, idx).trim();
                String valueStr = condition.substring(idx + op.length()).trim();

                // Strip surrounding quotes from string literals
                if ((valueStr.startsWith("'") && valueStr.endsWith("'")) ||
                    (valueStr.startsWith("\"") && valueStr.endsWith("\""))) {
                    valueStr = valueStr.substring(1, valueStr.length() - 1);
                }

                Object fieldValue = resolveField(field, data);
                if (fieldValue == null) {
                    logger.warning("Field '" + field + "' not found in input data. Available: " + data.keySet());
                    return false;
                }

                return compare(fieldValue, op, valueStr);
            }
        }
        logger.warning("Could not parse comparison condition: " + condition);
        return false;
    }

    /**
     * Find operator at top level (not inside parentheses), returning its index.
     * For single-char operators < and >, make sure it's not part of <= or >=.
     */
    private int findOperatorIndex(String condition, String op) {
        int parenDepth = 0;
        for (int i = 0; i <= condition.length() - op.length(); i++) {
            char c = condition.charAt(i);
            if (c == '(') { parenDepth++; continue; }
            if (c == ')') { parenDepth--; continue; }
            if (parenDepth != 0) continue;

            if (condition.startsWith(op, i)) {
                // For < and >, make sure it's not <= or >=
                if (op.equals("<") || op.equals(">")) {
                    if (i + 1 < condition.length() && condition.charAt(i + 1) == '=') {
                        continue; // this is <= or >=, skip
                    }
                }
                // Make sure it's not != or ==
                if (op.equals("=")) {
                    if (i > 0 && (condition.charAt(i-1) == '!' || condition.charAt(i-1) == '<' || condition.charAt(i-1) == '>')) {
                        continue;
                    }
                }
                return i;
            }
        }
        return -1;
    }

    private boolean compare(Object fieldValue, String op, String valueStr) {
        String fieldStr = fieldValue.toString().trim();

        // Try numeric comparison first
        try {
            double fieldNum = Double.parseDouble(fieldStr);
            double valueNum = Double.parseDouble(valueStr.trim());
            switch (op) {
                case "==": return fieldNum == valueNum;
                case "!=": return fieldNum != valueNum;
                case "<":  return fieldNum < valueNum;
                case ">":  return fieldNum > valueNum;
                case "<=": return fieldNum <= valueNum;
                case ">=": return fieldNum >= valueNum;
            }
        } catch (NumberFormatException e) {
            // Fall through to string comparison
        }

        // String comparison
        switch (op) {
            case "==": return fieldStr.equalsIgnoreCase(valueStr.trim());
            case "!=": return !fieldStr.equalsIgnoreCase(valueStr.trim());
            case "<":  return fieldStr.compareTo(valueStr.trim()) < 0;
            case ">":  return fieldStr.compareTo(valueStr.trim()) > 0;
            case "<=": return fieldStr.compareTo(valueStr.trim()) <= 0;
            case ">=": return fieldStr.compareTo(valueStr.trim()) >= 0;
        }
        return false;
    }

    private boolean evaluateContains(String condition, Map<String, Object> data) {
        String inner = condition.substring("contains(".length(), condition.length() - 1);
        String[] parts = inner.split(",", 2);
        if (parts.length != 2) return false;
        Object value = resolveField(parts[0].trim(), data);
        String search = parts[1].trim().replaceAll("^['\"]|['\"]$", "");
        return value != null && value.toString().contains(search);
    }

    private boolean evaluateStartsWith(String condition, Map<String, Object> data) {
        String inner = condition.substring("startsWith(".length(), condition.length() - 1);
        String[] parts = inner.split(",", 2);
        if (parts.length != 2) return false;
        Object value = resolveField(parts[0].trim(), data);
        String prefix = parts[1].trim().replaceAll("^['\"]|['\"]$", "");
        return value != null && value.toString().startsWith(prefix);
    }

    private boolean evaluateEndsWith(String condition, Map<String, Object> data) {
        String inner = condition.substring("endsWith(".length(), condition.length() - 1);
        String[] parts = inner.split(",", 2);
        if (parts.length != 2) return false;
        Object value = resolveField(parts[0].trim(), data);
        String suffix = parts[1].trim().replaceAll("^['\"]|['\"]$", "");
        return value != null && value.toString().endsWith(suffix);
    }

    private Object resolveField(String field, Map<String, Object> data) {
        // Support dot-notation for nested fields (basic)
        if (field.contains(".")) {
            String[] parts = field.split("\\.", 2);
            Object parent = data.get(parts[0]);
            if (parent instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> nested = (Map<String, Object>) parent;
                return nested.get(parts[1]);
            }
            return null;
        }
        return data.getOrDefault(field, null);
    }
}
