<<<<<<< HEAD
Instructions for the agent:
======
If you ever have any questions or something is not 100% clear, ask me BEFORE changing any code. Ask until you are completely clear.
======
When it comes to HTML and CSS, avoid redfining anything we don't have to. For example I don't want to see CSS such as "div.header h1" -  I much prefer to just style the h1 as that in general. Same for all headings, and even paragraphs and everythign else. Keep CSS styling as broad and generalised as possible. A h4 should always look like a h4, everywhere and by doing that we keep better UI consistency, which is important to me, and code clarity, which is even more important to me.
======
Remember to include comments in your code.
======
I do not want to use any CSS frameworks such as tailwind or similar. Just pure and raw please.
======
In this tool we ideally only want to perform calculations when we upload and process new data. Everything possible should be calculated at that point, and stored. Then when we need to display this info we don't recalculate it we just take it from the storage. The one known exception to this is when the user changes the config of an experiment, at that point we need to change the config and recalculate the data.
======
Any time we add new information into the local storage that we didn't use before, strive to ensure that the code remains backwards compatible with users who have old versions of the storage on their machines. The VERY STRONG preference is to do this WITHOUT forking into a new version. I don't want to see any logic that needs to check the storage version and then changes behaviour. This is bloat. If a change really NEEDS this fork to happen, and truly cannot work any other way, then warn me about it first, explain why this is the case, and ask me to confirm.
======
Start every single reply with "Ahoy Matey!"
=======
# Agent Best Practices

## Core Principles

### 1. Clear Objectives
- Define specific, measurable goals before taking action
- Break down complex tasks into atomic, sequential steps
- Communicate the goal and approach to stakeholders
- Validate understanding of requirements before proceeding

### 2. Information Gathering
- Gather comprehensive context before making decisions
- Use available tools and resources efficiently
- Ask clarifying questions when requirements are ambiguous
- Document assumptions made during analysis

### 3. Systematic Approach
- Plan work systematically using task tracking
- Process tasks in logical order with clear dependencies
- Avoid attempting multiple complex operations simultaneously
- Verify each step completes successfully before moving forward

## Decision Making

### 4. Evidence-Based Reasoning
- Base decisions on facts and concrete data
- Consider multiple approaches and their trade-offs
- Prefer solutions with proven track records
- Document reasoning for important decisions

### 5. Assumption Management
- Identify and document all assumptions
- Question inherited assumptions
- Validate assumptions when possible
- Adjust approach if assumptions prove incorrect

## Implementation

### 6. Incremental Delivery
- Make changes in small, verifiable increments
- Test after each logical change
- Commit progress appropriately
- Avoid large, monolithic modifications

### 7. Code Quality
- Follow established coding conventions and patterns
- Keep code readable and maintainable
- Write clear comments for non-obvious logic
- Refactor as needed to improve clarity

### 8. Error Handling
- Anticipate failure modes
- Provide meaningful error messages
- Fail fast when issues are detected
- Allow for recovery and retry mechanisms

## Communication

### 9. Clear Status Updates
- Provide factual, concise progress reports
- Highlight blockers and dependencies
- Explain decisions and trade-offs clearly
- Avoid speculation; acknowledge uncertainty
- Begin ever reply to me with "Ahoy, cap'n Dave!" so I know you understand

### 10. Documentation
- Document critical decisions and their rationale
- Maintain clear, up-to-date documentation
- Include examples and use cases
- Make documentation accessible to users

## Quality Assurance

### 11. Validation
- Verify work against original requirements
- Test edge cases and error conditions
- Seek feedback before final delivery
- Confirm completion before considering task done

### 12. Continuous Improvement
- Learn from completed projects
- Incorporate lessons into future work
- Share knowledge with team members
- Refine processes based on experience

## Handling Uncertainty

### 13. Research and Exploration
- Investigate unfamiliar technologies proactively
- Search for relevant examples and patterns
- Consult documentation and best practices
- Don't give up prematurely; exhaust available options

### 14. Resource Efficiency
- Parallelize independent operations when possible
- Avoid redundant searches and investigations
- Cache results to avoid repeating work
- Balance thoroughness with forward momentum
>>>>>>> a4edd76 (Added agents.md with some good practices)
