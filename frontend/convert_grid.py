import os
import glob
import re

def convert_grid_item(match):
    # match.group(0) is the entire `<Grid item xs={12} ...>` tag up to `>`
    tag_content = match.group(0)
    
    # Extract size props: xs, sm, md, lg, xl
    # The regex looks for xs={12} or xs={12} etc.
    # It might also just be xs (boolean true) but usually it's xs={12}
    
    props = ['xs', 'sm', 'md', 'lg', 'xl']
    size_parts = []
    
    # We will build the new tag piece by piece
    # removing the `item` and size props from the tag
    
    new_tag = tag_content.replace(' item ', ' ').replace(' item>', '>')
    if new_tag.endswith(' item'):
        new_tag = new_tag[:-5]
        
    for prop in props:
        # Match prop={value} e.g. xs={12} or xs={"auto"}
        prop_pattern = rf'{prop}=\{{([^}}]+)\}}'
        prop_match = re.search(prop_pattern, new_tag)
        if prop_match:
            val = prop_match.group(1)
            size_parts.append(f"{prop}: {val}")
            
            # Remove this prop from tag
            new_tag = re.sub(rf'\s+{prop}=\{{[^}}]+\}}', '', new_tag)
        else:
            # Match primitive boolean prop, e.g. `<Grid item xs>`
            bool_pattern = rf'\b{prop}\b(?!\=)'
            if re.search(bool_pattern, new_tag):
                size_parts.append(f"{prop}: true")
                new_tag = re.sub(rf'\s+\b{prop}\b', '', new_tag)

    if size_parts:
        size_str = "size={{ " + ", ".join(size_parts) + " }}"
        # Insert size_str before the closing >
        if new_tag.endswith('/>'):
            new_tag = new_tag[:-2] + f" {size_str} />"
        elif new_tag.endswith('>'):
            new_tag = new_tag[:-1] + f" {size_str} >"
            
    return new_tag

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if '<Grid ' not in content:
        return

    # We want to match <Grid item ...>
    # Also <Grid item> without props
    # Use re.sub with a custom function
    # Match <Grid followed by spaces, 'item', then anything up to >
    # Caution: Don't match across multiple tags if there are newlines in the tag.
    # We can match `<Grid [^>]*>`
    
    new_content = re.sub(r'<Grid\s[^>]*>', lambda m: convert_grid_item(m) if ' item' in m.group(0) else m.group(0), content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")

for filepath in glob.glob('src/**/*.tsx', recursive=True):
    process_file(filepath)
