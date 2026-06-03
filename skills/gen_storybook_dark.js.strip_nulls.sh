#!/bin/bash
# Run after any edit to gen_storybook_dark.js to strip Edit-tool null-byte padding
python3 -c "
f='$(dirname $0)/gen_storybook_dark.js'
d=open(f,'rb').read(); c=d.rstrip(b'\x00')
open(f,'wb').write(c)
if len(d)!=len(c): print(f'Stripped {len(d)-len(c)} null bytes')
"
