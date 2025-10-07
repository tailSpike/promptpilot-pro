const output = {
  "content": "Hi",
  "generatedText": "[Simulated OpenAI preview] Hi",
  "model": "gpt-4o-mini",
  "tokens": 0,
  "primaryProvider": "openai",
  "modelOutputs": {
    "openai": {
      "gpt-4o-mini": {
        "label": "OpenAI",
        "text": "[Simulated OpenAI preview] Hi",
        "success": true,
        "tokens": 0,
        "latencyMs": 0,
        "metadata": {
          "simulated": true
        },
        "warnings": [
          "Simulated preview output because provider authentication failed."
        ]
      }
    },
    "anthropic": {
      "claude-3-haiku-20240307": {
        "label": "Claude",
        "success": false,
        "latencyMs": 0,
        "error": "invalid x-api-key",
        "warnings": [
          "Attempt 1 failed (178ms): invalid x-api-key",
          "Attempt 2 failed (137ms): invalid x-api-key"
        ]
      }
    }
  },
  "providerResults": [
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "label": "OpenAI",
      "success": false,
      "latencyMs": 0,
      "warnings": [
        "Attempt 1 failed (264ms): Incorrect API key provided: your-ope*******-key. You can find your API key at https://platform.openai.com/account/api-keys.",
        "Attempt 2 failed (91ms): Incorrect API key provided: your-ope*******-key. You can find your API key at https://platform.openai.com/account/api-keys."
      ],
      "error": "Incorrect API key provided: your-ope*******-key. You can find your API key at https://platform.openai.com/account/api-keys.",
      "retries": 1
    },
    {
      "provider": "anthropic",
      "model": "claude-3-haiku-20240307",
      "label": "Claude",
      "success": false,
      "latencyMs": 0,
      "warnings": [
        "Attempt 1 failed (178ms): invalid x-api-key",
        "Attempt 2 failed (137ms): invalid x-api-key"
      ],
      "error": "invalid x-api-key",
      "retries": 1
    },
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "label": "OpenAI",
      "success": true,
      "outputText": "[Simulated OpenAI preview] Hi",
      "tokensUsed": 0,
      "latencyMs": 0,
      "warnings": [
        "Simulated preview output because provider authentication failed."
      ],
      "raw": {
        "simulated": true,
        "reason": "auth-fallback"
      },
      "retries": 0,
      "metadata": {
        "simulated": true
      }
    }
  ],
  "resolvedVariables": {},
  "warnings": [
    "Attempt 1 failed (264ms): Incorrect API key provided: your-ope*******-key. You can find your API key at https://platform.openai.com/account/api-keys.",
    "Attempt 2 failed (91ms): Incorrect API key provided: your-ope*******-key. You can find your API key at https://platform.openai.com/account/api-keys.",
    "Attempt 1 failed (178ms): invalid x-api-key",
    "Attempt 2 failed (137ms): invalid x-api-key",
    "All configured providers returned authentication errors. Showing simulated output for preview only.",
    "openai:gpt-4o-mini → Incorrect API key provided: your-ope*******-key. You can find your API key at https://platform.openai.com/account/api-keys.",
    "anthropic:claude-3-haiku-20240307 → invalid x-api-key"
  ]
};

const outputHasResolvedResult = (output) => {
  if (!output || typeof output !== 'object') {
    return false;
  }

  const record = output;
  const providerResults = record.providerResults;
  if (Array.isArray(providerResults)) {
    const hasSuccess = providerResults.some((entry) => {
      if (entry && typeof entry === 'object') {
        return entry.success === true;
      }
      return false;
    });

    if (hasSuccess) {
      return true;
    }
  }

  const modelOutputs = record.modelOutputs;
  if (modelOutputs && typeof modelOutputs === 'object') {
    const providerValues = Object.values(modelOutputs);
    for (const providerEntry of providerValues) {
      if (providerEntry && typeof providerEntry === 'object') {
        const modelEntries = Object.values(providerEntry);
        const hasSuccess = modelEntries.some((modelEntry) => {
          if (modelEntry && typeof modelEntry === 'object') {
            return modelEntry.success === true;
          }
          return false;
        });
        if (hasSuccess) {
          return true;
        }
      }
    }
  }

  if (typeof record.generatedText === 'string' && record.generatedText.trim().length > 0) {
    return true;
  }

  if (typeof record.content === 'string' && record.content.trim().length > 0) {
    return true;
  }

  return false;
};

console.log('hasResolved?', outputHasResolvedResult(output));
