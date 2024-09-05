#!/bin/bash

set -e

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: Please set the OPENAI_API_KEY environment variable"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq could not be found, please install it."
    exit 1
fi

# Add all changes first
git add .

# Get the git diff of staged changes
diff=$(git diff --staged)

if [ -z "$diff" ]; then
    echo "No changes to commit"
    exit 0
fi

# Escape the diff for JSON
escaped_diff=$(printf '%s' "$diff" | jq -Rs .)

# Prepare the payload for the OpenAI API
payload=$(jq -n \
    --arg model "gpt-3.5-turbo" \
    --arg system_content "You are a helpful assistant that generates concise and informative git commit messages." \
    --arg user_content "Generate a concise git commit message for the following changes:$escaped_diff" \
    '{
        model: $model,
        messages: [
            {role: "system", content: $system_content},
            {role: "user", content: $user_content}
        ]
    }')

# Generate commit message using OpenAI API
response=$(curl -s https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d "$payload")

# Check for API errors
error_message=$(echo "$response" | jq -r '.error.message // empty')
if [ ! -z "$error_message" ]; then
    echo "Error: API request failed. $error_message"
    if [[ "$error_message" == *"Incorrect API key provided"* ]]; then
        echo "Please check your OPENAI_API_KEY environment variable."
    fi
    echo "Aborting commit. Please fix the error and try again."
    exit 1
fi

# Extract the message content
message=$(echo "$response" | jq -r '.choices[0].message.content')

# Check if message is empty
if [ -z "$message" ]; then
    echo "Error: Failed to generate commit message."
    echo "OpenAI API response: $response"
    echo "Aborting commit. Please try again."
    exit 1
fi

# Commit with generated message
git commit -m "$message"
git status

echo "Commit completed successfully"
