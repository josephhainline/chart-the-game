#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

DIRECTORY="."
OUTPUT_FILE="$DIRECTORY/allfiles.txt"
TEMP_FILE="$DIRECTORY/temp_allfiles.txt"

echo "Debug: Starting script"

mkdir -p "$(dirname "$OUTPUT_FILE")"
> "$TEMP_FILE"

echo "Debug: Generating file listing"
echo "// File Listing:" > "$OUTPUT_FILE"
find "$DIRECTORY" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) | 
grep -vE "(\.expo|node_modules|build|dist|__tests__|__mocks__|\.test\.|\.spec\.)" | 
sort | 
sed 's|^./||' >> "$OUTPUT_FILE"

echo "Debug: Adding important root files to listing"
for file in .gitignore package.json tsconfig.json babel.config.js app.json expo-env.d.ts; do
    if [ -f "$DIRECTORY/$file" ]; then
        echo "$file" >> "$OUTPUT_FILE"
    fi
done

echo -e "\n\n" >> "$OUTPUT_FILE"

add_file_content() {
    if [ -f "$1" ]; then
        echo "Debug: Adding file $1"
        echo "// File: $1" >> "$TEMP_FILE"
        cat "$1" >> "$TEMP_FILE"
        echo -e "\n\n" >> "$TEMP_FILE"
    else
        echo "Debug: File not found $1"
    fi
}

echo "Debug: Processing root files"
# Important root files
for file in .gitignore package.json tsconfig.json babel.config.js app.json expo-env.d.ts; do
    add_file_content "$DIRECTORY/$file"
done

# Function to process directories
process_directory() {
    local dir=$1
    
    echo "Debug: Processing directory $dir"
    if [ -d "$dir" ]; then
        find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) | 
        grep -vE "(node_modules|build|dist|__tests__|__mocks__|.test.|.spec.)" |
        while read -r file; do
            add_file_content "$file"
        done
    else
        echo "Debug: Directory not found $dir"
    fi
}

echo "Debug: Processing app directory"
process_directory "$DIRECTORY/app"

echo "Debug: Processing components directory"
process_directory "$DIRECTORY/components"

echo "Debug: Processing constants directory"
process_directory "$DIRECTORY/constants"

echo "Debug: Processing assets directory"
process_directory "$DIRECTORY/assets"

# Append the temp file to the output file
cat "$TEMP_FILE" >> "$OUTPUT_FILE"
rm "$TEMP_FILE"

echo "Contents of important files have been copied to $OUTPUT_FILE"

# Calculate approximate token count
total_chars=$(wc -m < "$OUTPUT_FILE")
total_tokens=$((total_chars / 4))
formatted_tokens=$(printf "%'d\n" $total_tokens)
echo "Approximate tokens: $formatted_tokens"

# Copy to clipboard (macOS)
cat "$OUTPUT_FILE" | pbcopy
echo "Contents copied to clipboard using pbcopy"

echo "Debug: Script completed"
