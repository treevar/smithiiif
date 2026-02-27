#!/bin/bash
#Need node, npm, git, and tsc
#Get manifesto-3d
cd libs
FIRST_TIME=0
which tsc > /dev/null 2>&1
if [[ $? -eq 1 ]]; then
    echo "tsc not found, installing..."
    sudo apt install node-typescript
fi
if [[ ! -d "manifesto-3d/.git" ]]; then #First time install
    FIRST_TIME=1
    echo "manifesto-3d not found, cloning..."
    git clone https://github.com/treevar/manifesto-3d.git manifesto-3d
fi
if [[ $FIRST_TIME -eq 0 ]]; then 
    echo "manifesto-3d found"
    PULL_OUTPUT=$(git -C "manifesto-3d" pull)
fi
if [[ $FIRST_TIME -eq 1 ]] || [[ ! $PULL_OUTPUT == *"Already up to date."* ]]; then #Update
    echo "Building manifesto-3d"
    cd manifesto-3d
    npm install
    npm run build
    cd ../
fi
#Back to parent dir
echo "Building voyager"
cd ../
npm install
npm run build-dev-local
npx serve dist
