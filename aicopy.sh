#!/bin/bash

# Directory containing the React Native app
DIRECTORY="."

# Output file
OUTPUT_FILE="$DIRECTORY/allfiles.txt"

# Create output directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Clear the output file
> "$OUTPUT_FILE"

# Function to add file contents to the output file
add_file_content() {
    if [ -f "$1" ]; then
        echo "// File: $1" >> "$OUTPUT_FILE"
        cat "$1" >> "$OUTPUT_FILE"
        echo -e "\n\n" >> "$OUTPUT_FILE"
    fi
}

# List of important files
IMPORTANT_FILES=(
    "$DIRECTORY/.env"
    "$DIRECTORY/.gitignore"
    "$DIRECTORY/package.json"
    "$DIRECTORY/README.md"
    "$DIRECTORY/turbo.json"
    "$DIRECTORY/tsconfig.json"
    "$DIRECTORY/babel.config.js"
    "$DIRECTORY/metro.config.js"
)

# Add contents of important files
for file in "${IMPORTANT_FILES[@]}"; do
    add_file_content "$file"
done

# Add list of important files to the output
echo -e "\n// List of Important Files:" >> "$OUTPUT_FILE"
for file in "${IMPORTANT_FILES[@]}"; do
    echo "$file" >> "$OUTPUT_FILE"
done

echo "Contents of important files have been copied to $OUTPUT_FILE"

# Add recursive listing of all files in the directory
echo -e "\n// Recursive listing of all files:" >> "$OUTPUT_FILE"
find "$DIRECTORY" -type f -print0 | xargs -0 ls -1 | sort >> "$OUTPUT_FILE"

# Calculate approximate token count (assuming 4 characters per token)
total_chars=$(wc -m < "$OUTPUT_FILE")
total_tokens=$((total_chars / 4))
formatted_tokens=$(printf "%'d\n" $total_tokens)
echo "Approximate tokens: $formatted_tokens"

# Copy the contents to the clipboard
# macOS
cat "$OUTPUT_FILE" | pbcopy
echo "Contents copied to clipboard using pbcopy"
