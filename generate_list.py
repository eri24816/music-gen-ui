# generates resource/list.json

import json

from pathlib import Path

root = Path('resource')

my_list = {}
# run ls in all subdirectories and store {dirs: [...], files: [...]}
for subdir in root.glob('**'):
    if subdir.is_dir():
        subdir_path = str(subdir.relative_to(root)).replace('\\', '/')
        if subdir_path == '.':
            subdir_path = ''
        my_list[subdir_path] = {
            "dirs": [],
            "files": []
        }
        for file in subdir.iterdir():
            if file.is_file():
                my_list[subdir_path]['files'].append(str(file.relative_to(subdir)))
            elif file.is_dir():
                my_list[subdir_path]['dirs'].append(file.name.replace('\\', '/'))

with open('resource/list.json', 'w') as f:
    json.dump(my_list, f)
