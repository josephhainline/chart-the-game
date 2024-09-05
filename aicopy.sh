#!/bin/bash

set -e

DIRECTORY="."
OUTPUT_FILE="$DIRECTORY/allfiles.txt"
TEMP_FILE="$DIRECTORY/temp_allfiles.txt"

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
LIGHT_BLUE='\033[1;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Progress bar function
progress_bar() {
    local current=$1
    local total=$2
    local width=20
    local percentage=$((current * 100 / total))
    local completed=$((width * current / total))
    local remaining=$((width - completed))
    
    printf "\r${GREEN}Progress: ${LIGHT_BLUE}["
    printf "%${completed}s" | tr ' ' '▓'
    printf "%${remaining}s" | tr ' ' '░'
    printf "]${NC} ${percentage}%%"
}

echo -e "${GREEN}Starting script...${NC}"

mkdir -p "$(dirname "$OUTPUT_FILE")"
> "$TEMP_FILE"

echo -e "${LIGHT_BLUE}Generating file listing...${NC}"
echo "// File Listing:" > "$OUTPUT_FILE"
find "$DIRECTORY" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) | 
grep -vE "(\.expo|node_modules|build|dist|__tests__|__mocks__|\.test\.|\.spec\.)" | 
sort | 
sed 's|^./||' >> "$OUTPUT_FILE"

echo -e "\n\n" >> "$OUTPUT_FILE"

for file in .gitignore package.json tsconfig.json babel.config.js app.json expo-env.d.ts; do
    [ -f "$DIRECTORY/$file" ] && echo "$file" >> "$OUTPUT_FILE"
done

echo -e "\n\n" >> "$OUTPUT_FILE"

add_file_content() {
    if [ -f "$1" ]; then
        echo "// File: $1" >> "$TEMP_FILE"
        cat "$1" >> "$TEMP_FILE"
        echo -e "\n\n" >> "$TEMP_FILE"
    fi
}

echo -e "${LIGHT_BLUE}Processing files...${NC}"
files_to_process=($(find "$DIRECTORY" \( -path "*/app" -o -path "*/components" -o -path "*/constants" -o -path "*/assets" \) -prune -o -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name ".gitignore" -o -name "package.json" -o -name "tsconfig.json" -o -name "babel.config.js" -o -name "app.json" -o -name "expo-env.d.ts" \) -print | grep -vE "(\.expo|node_modules|build|dist|__tests__|__mocks__|\.test\.|\.spec\.)"))
total_files=${#files_to_process[@]}
processed=0

for file in "${files_to_process[@]}"; do
    add_file_content "$file"
    ((processed++))
    progress_bar $processed $total_files
done

for dir in app components constants assets; do
    if [ -d "$DIRECTORY/$dir" ]; then
        dir_files=($(find "$DIRECTORY/$dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) | grep -vE "(node_modules|build|dist|__tests__|__mocks__|.test.|.spec.)"))
        dir_total=${#dir_files[@]}
        dir_processed=0
        for file in "${dir_files[@]}"; do
            add_file_content "$file"
            ((dir_processed++))
            ((processed++))
            progress_bar $processed $((total_files + dir_total))
        done
        total_files=$((total_files + dir_total))
    fi
done

echo -e "\n"

cat "$TEMP_FILE" >> "$OUTPUT_FILE"
rm "$TEMP_FILE"

echo -e "${GREEN}Contents copied to $OUTPUT_FILE${NC}"

total_chars=$(wc -m < "$OUTPUT_FILE")
total_tokens=$((total_chars / 4))
formatted_tokens=$(printf "%'d" $total_tokens)
echo -e "${YELLOW}Approximate tokens: ${NC}$formatted_tokens"

cat "$OUTPUT_FILE" | pbcopy
echo -e "${GREEN}Contents copied to clipboard${NC}"

echo -e "${GREEN}Script completed successfully!${NC}"
