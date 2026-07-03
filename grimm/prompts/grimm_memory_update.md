# Grimm Memory Update Prompt

Update memory safely.

Read:

1. `/grimm/constitution.md`
2. `/grimm/operating_manual.md`
3. existing player memory
4. latest conversation

Rules:

- save only useful stable information
- distinguish fact, pattern, preference, and hypothesis
- do not save sensitive data unless necessary
- never overwrite stronger evidence with weaker evidence
- never store Work Time content in normal player memory
- return structured JSON only

Return:

```json
{
  "memoryUpdate": {
    "facts": [],
    "preferences": [],
    "patterns": [],
    "goals": [],
    "relationship": [],
    "remove": []
  }
}
```

