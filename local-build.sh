#!/bin/bash
#Need node, npm, git, and tsc

#Install tsc if not found
which tsc > /dev/null 2>&1
if [[ $? -eq 1 ]]; then
    echo "tsc not found, installing..."
    sudo apt install node-typescript
fi

cd libs

if [[ ! -d "manifesto-3d/.git" ]]; then #Doesn't have a .git folder, so we assume it hasn't been cloned yet
    echo "manifesto-3d not found, cloning..."
    git clone https://github.com/treevar/manifesto-3d.git manifesto-3d
else
    echo "manifesto-3d found"
    PULL_OUTPUT=$(git -C "manifesto-3d" pull)
fi

if [[ $PULL_OUTPUT != *"Already up to date."* ]]; then #Build manifesto-3d if there were changes
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
#Host the dist folder locally
npx serve dist
