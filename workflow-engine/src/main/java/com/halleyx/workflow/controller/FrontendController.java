package com.halleyx.workflow.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class FrontendController {

    @RequestMapping(value = {"/", "/dashboard", "/workflows", "/execute", "/audit"})
    public String index() {
        return "forward:/index.html";
    }
}
