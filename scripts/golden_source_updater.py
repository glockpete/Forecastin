from datetime import datetime, timezone
import argparse
import json
import re
import os
import sys

GOLDEN_SOURCE_PATH = "docs/GOLDEN_SOURCE.md"
CHANGELOG_HEADER = "## 7. Changelog"
TASK_BOARD_HEADER = "## 4. Task Board"
AC_HEADER = "## 3. Acceptance Criteria"
ARTIFACTS_HEADER = "## 6. Artefacts"
JSON_STATE_MARKER_START = "## 8. JSON State Block"

def generate_id(task_title, timestamp):
    """Generates a deterministic ID T-<yyyy-mm-dd>-<slug>"""
    date_str = timestamp.strftime("%Y-%m-%d")
    # Create slug: lowercase, replace non-alphanumeric/space with nothing, replace space with hyphen
    slug = re.sub(r'[^\w\s-]', '', task_title).strip().lower()
    slug = re.sub(r'[-\s]+', '-', slug)
    return f"T-{date_str}-{slug}"

def safe_serialize_message(data):
    """Uses orjson if available, otherwise standard json for serialization."""
    try:
        import orjson
        return orjson.dumps(data).decode('utf-8')
    except ImportError:
        import json
        return json.dumps(data)

def find_section_indices(content_lines, header_text):
    """Finds the start index of a header and the start index of the next major section."""
    start_index = -1
    end_index = len(content_lines)
    
    for i, line in enumerate(content_lines):
        stripped_line = line.strip()
        if stripped_line.startswith(header_text):
            start_index = i
        elif start_index != -1 and (stripped_line.startswith('## ') or stripped_line.startswith('---')):
            end_index = i
            break
    
    return start_index, end_index

def update_changelog(content_lines, log_id, mode, task_title, outcome_emoji, timestamp_str):
    """Updates the Changelog section."""
    new_entry = f"- **{log_id}** ({timestamp_str}): {mode} - {task_title} {outcome_emoji}\n"
    
    start_index, end_index = find_section_indices(content_lines, CHANGELOG_HEADER)
    
    if start_index == -1:
        return None, "Error: Changelog header not found."

    # Find insertion point: after the header, before the first list item or end of section
    insert_line = start_index + 1
    while insert_line < end_index and content_lines[insert_line].strip().startswith('-'):
        insert_line += 1
    
    # Check for duplicates before inserting
    for i in range(start_index + 1, end_index):
        if log_id in content_lines[i]:
            return content_lines, f"Warning: Changelog entry for ID {log_id} already exists. Skipping insertion."

    content_lines.insert(insert_line, new_entry)
    
    return content_lines, None

def update_task_board(content_lines, log_id, task_title, outcome_emoji):
    """Updates the Task Board section by moving/creating task cards."""
    
    # Determine target section based on emoji (Requirement 3 & 4)
    if outcome_emoji == '✅':
        target_section_name = "Completed"
    elif outcome_emoji in ('🔄', '⏳'):
        target_section_name = "In Progress"
    elif outcome_emoji == '❌':
        target_section_name = "Blocked"
    else:
        target_section_name = "Backlog" # Default for new tasks or unknown outcomes
        
    task_line_pattern = re.compile(rf"^\s*-\s*{re.escape(log_id)}.*", re.IGNORECASE)
    
    # 1. Find and remove existing task line if present anywhere
    new_content_lines = []
    task_found_and_removed = False
    
    board_start, board_end = find_section_indices(content_lines, TASK_BOARD_HEADER)
    if board_start == -1:
        return content_lines, "Error: Task Board header not found."

    # Iterate through the entire document to remove existing entry, regardless of section
    for i, line in enumerate(content_lines):
        if i >= board_start and i < board_end:
            if task_line_pattern.match(line):
                task_found_and_removed = True
                continue # Skip adding this line to new_content_lines
        new_content_lines.append(line)

    
    # 2. Insert new line in the target section
    target_header = f"### {target_section_name}"
    insert_index = -1
    
    # Scan the potentially modified lines (new_content_lines)
    for i, line in enumerate(new_content_lines):
        if line.strip() == target_header:
            insert_index = i + 1
            # Find end of list in this section
            while insert_index < len(new_content_lines) and new_content_lines[insert_index].strip().startswith('-'):
                insert_index += 1
            break
            
    if insert_index == -1:
        return new_content_lines, f"Error: Target Task Board section '{target_header}' not found."

    new_task_line = f"- {log_id}: {task_title} ({outcome_emoji})\n"
    
    # Check if task already exists in target section (after removal attempt)
    for i in range(insert_index - 1, board_start, -1):
        if new_content_lines[i].strip() == new_task_line.strip():
            return new_content_lines, f"Warning: Task already present in '{target_section_name}' section. No change made."

    new_content_lines.insert(insert_index, new_task_line)
    
    return new_content_lines, None

def update_ac_criteria(content_lines, task_title):
    """Updates Acceptance Criteria checkboxes if the task title matches an AC description."""
    
    ac_start, ac_end = find_section_indices(content_lines, AC_HEADER)
    if ac_start == -1:
        return content_lines, "Warning: Acceptance Criteria header not found. Skipping AC update."

    updated_lines = list(content_lines)
    changes_made = False
    
    for i in range(ac_start + 1, ac_end):
        line = content_lines[i]
        
        # Regex to capture prefix, checkbox state, and description
        match = re.match(r'(\s*-\s*)(\[ ?\])(.*)', line)
        if match:
            prefix, checkbox, description = match.groups()
            
            # Check if description contains task_title (case-insensitive)
            if task_title.lower() in description.lower():
                if checkbox == '[ ]':
                    # Check off the criterion
                    updated_lines[i] = f"{prefix}[x]{description}\n"
                    changes_made = True
                elif checkbox == '[x]':
                    # Already checked off, no change needed
                    pass
        
    if changes_made:
        return updated_lines, None
    else:
        return content_lines, "Warning: No matching Acceptance Criteria found for task title. Skipping AC update."


def update_artifacts(content_lines, artefact_paths):
    """Adds artefact links to Section 6. Artefacts."""
    
    artifacts_start, artifacts_end = find_section_indices(content_lines, ARTIFACTS_HEADER)
    if artifacts_start == -1:
        return content_lines, "Warning: Artefacts header not found. Skipping artefact update."

    # Find insertion point: after '### Core Implementation Files' if it exists, otherwise after header.
    insert_point = artifacts_start + 1
    core_files_start = -1
    
    for i in range(artifacts_start + 1, artifacts_end):
        if content_lines[i].strip() == "### Core Implementation Files":
            core_files_start = i
            break
    
    if core_files_start != -1:
        insert_point = core_files_start + 1
        # Find end of list under this subsection
        while insert_point < artifacts_end and content_lines[insert_point].strip().startswith('-'):
            insert_point += 1
    
    
    new_lines = []
    for path in artefact_paths:
        # Requirement 5 & 6: Add artefact links using deterministic formatting
        new_lines.append(f"- [`{path}`]({path})\n")

    if not new_lines:
        return content_lines, None

    # Insert new lines
    content_lines[insert_point:insert_point] = new_lines
    
    return content_lines, None

def update_json_state(content_lines, timestamp_str):
    """Updates the last_updated timestamp in the JSON State Block (Section 8)."""
    
    json_start = -1
    json_end = -1
    
    for i, line in enumerate(content_lines):
        if line.strip().startswith(JSON_STATE_MARKER_START):
            json_start = i
        elif json_start != -1 and line.strip() == "```":
            json_end = i
            break
            
    if json_start == -1 or json_end == -1:
        return content_lines, "Warning: JSON State Block markers not found. Skipping timestamp update."

    json_content = "".join(content_lines[json_start + 1:json_end])
    
    try:
        data = json.loads(json_content)
        
        # Update timestamp
        if 'project' in data and 'last_updated' in data['project']:
            data['project']['last_updated'] = timestamp_str
            
            new_json_content = safe_serialize_message(data)
            
            # Reconstruct content lines
            updated_lines = content_lines[:json_start + 1] + [f"{new_json_content}\n"] + content_lines[json_end:]
            return updated_lines, None
        else:
            return content_lines, "Warning: 'project.last_updated' field not found in JSON state block."
            
    except json.JSONDecodeError as e:
        return content_lines, f"Error decoding JSON state block: {e}"


def generate_diff(original_content, new_content):
    """Generates a minimal diff for conflict reporting (Requirement 9)."""
    
    original_lines = original_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    
    min_len = min(len(original_lines), len(new_lines))
    
    # Find common prefix
    prefix_len = 0
    while prefix_len < min_len and original_lines[prefix_len] == new_lines[prefix_len]:
        prefix_len += 1
        
    # Find common suffix (from the end)
    suffix_len = 0
    while suffix_len < min_len - prefix_len and original_lines[-1 - suffix_len] == new_lines[-1 - suffix_len]:
        suffix_len += 1
        
    # Construct diff block
    diff_output = []
    diff_output.append("<<<<<<< SEARCH\n")
    diff_output.extend(original_lines[prefix_len : len(original_lines) - suffix_len])
    diff_output.append("=======\n")
    diff_output.extend(new_lines[prefix_len : len(new_lines) - suffix_len])
    diff_output.append(">>>>>>> REPLACE\n")
    
    return "".join(diff_output)


def update_golden_source(task_id, mode, task_title, outcome_emoji, artefact_paths):
    
    # 1. Get current time for timestamp and ID generation
    current_time_utc = datetime.now(timezone.utc)
    # Format timestamp to match existing format (ISO 8601 UTC with Z)
    timestamp_str = current_time_utc.isoformat().replace('+00:00', 'Z')
    
    # 6. Maintain stable IDs
    new_task_id = generate_id(task_title, current_time_utc)
    
    # Use provided task_id if available, otherwise use generated ID for logging purposes
    log_id = task_id if task_id and task_id.startswith("T-") else new_task_id
    
    try:
        with open(GOLDEN_SOURCE_PATH, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        original_lines = original_content.splitlines(keepends=True)
        modified_lines = list(original_lines)
        
        warnings = []

        # 2. Update Changelog
        modified_lines, error = update_changelog(modified_lines, log_id, mode, task_title, outcome_emoji, timestamp_str)
        if error and error.startswith("Error:"): return error
        if error and error.startswith("Warning:"): warnings.append(error)
        
        # 3. Update Task Board
        modified_lines, error = update_task_board(modified_lines, log_id, task_title, outcome_emoji)
        if error and error.startswith("Error:"): return error
        if error and error.startswith("Warning:"): warnings.append(error)
        
        # 4. Update Acceptance Criteria
        modified_lines, error = update_ac_criteria(modified_lines, task_title)
        if error and error.startswith("Error:"): return error
        if error and error.startswith("Warning:"): warnings.append(error)
        
        # 5. Add artefact links
        modified_lines, error = update_artifacts(modified_lines, artefact_paths)
        if error and error.startswith("Error:"): return error
        if error and error.startswith("Warning:"): warnings.append(error)
        
        # 8. Update JSON State Block timestamp
        modified_lines, error = update_json_state(modified_lines, timestamp_str)
        if error and error.startswith("Error:"): return error
        if error and error.startswith("Warning:"): warnings.append(error)
        
        new_content = "".join(modified_lines)
        
        # 7. Preserve all existing content not owned by the generator (handled by reading/writing full file)
        
        if original_content != new_content:
            # 9. Handle conflicts by printing minimal diff and proposing single correct merge
            diff = generate_diff(original_content, new_content)
            
            with open(GOLDEN_SOURCE_PATH, 'w', encoding='utf-8') as f:
                f.write(new_content)
                
            result_msg = "Golden Source sync: OK"
            if warnings:
                result_msg += " with warnings: " + "; ".join(warnings)
            
            result_msg += f". Task ID used for logging: {log_id}. Generated ID: {new_task_id}. Diff of applied changes: \n{diff}"
            return result_msg
        else:
            result_msg = "Golden Source sync: OK. File content was already up to date."
            if warnings:
                result_msg += " with warnings: " + "; ".join(warnings)
            return result_msg

    except FileNotFoundError:
        return f"Error: Golden Source file not found at {GOLDEN_SOURCE_PATH}. Proposed fix: Ensure directory structure exists and file is present."
    except Exception as e:
        return f"Error during Golden Source update: {e}. Proposed fix: Check input parameters and file structure."

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update the GOLDEN_SOURCE.md file.")
    parser.add_argument("--task_id", required=True, help="ID of the task (e.g., T-2025-11-04-example)")
    parser.add_argument("--mode", required=True, help="Execution mode (e.g., code, architect)")
    parser.add_argument("--task_title", required=True, help="Title of the task")
    parser.add_argument("--outcome_emoji", required=True, help="Emoji representing outcome (e.g., ✅, 🔄, ❌)")
    parser.add_argument("--artefact_paths", required=True, nargs='+', help="List of artefact paths")
    
    args = parser.parse_args()
    
    result = update_golden_source(
        task_id=args.task_id,
        mode=args.mode,
        task_title=args.task_title,
        outcome_emoji=args.outcome_emoji,
        artefact_paths=args.artefact_paths
    )
    # Handle Unicode encoding for Windows console
    try:
        print(result)
    except UnicodeEncodeError:
        # Fallback for Windows console: encode with error handling
        print(result.encode('ascii', errors='replace').decode('ascii'))