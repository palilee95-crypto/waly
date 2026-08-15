import re

with open('app/(merchant)/_components/TemplateStudio.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
keys_seen = set()
in_styles = False

for i, line in enumerate(lines):
    if line.startswith('const styles = StyleSheet.create({'):
        in_styles = True
        new_lines.append(line)
        continue
    
    if in_styles:
        if line.startswith('});'):
            in_styles = False
            new_lines.append(line)
            continue
        
        # Check if line defines a new style object
        match = re.match(r'^\s+([a-zA-Z0-9_]+):\s*\{', line)
        if match:
            key = match.group(1)
            if key in keys_seen:
                # We have a duplicate key, skip this entire block until '},'
                skip_block = True
                continue
            else:
                keys_seen.add(key)
                new_lines.append(line)
                skip_block = False
                continue
        elif 'skip_block' in locals() and skip_block:
            if re.match(r'^\s+\},', line) or re.match(r'^\s+\}', line):
                skip_block = False
            continue
            
    new_lines.append(line)

with open('app/(merchant)/_components/TemplateStudio.tsx', 'w') as f:
    f.writelines(new_lines)

