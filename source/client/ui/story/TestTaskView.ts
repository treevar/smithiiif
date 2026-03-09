/**
 * 3D Foundation Project
 * Copyright 2025 Smithsonian Institution
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import CVTestTask from "../../components/CVTestTask";
import Node from "@ff/graph/Node";
import Component from "@ff/graph/Component";
import Property from "@ff/graph/Property";

import "@ff/scene/ui/PropertyView";

import { customElement, property, html } from "@ff/ui/CustomElement";
import Tree from "@ff/ui/Tree";

import CVSettingsTask from "../../components/CVSettingsTask";
import { TaskView } from "../../components/CVTask";
import NVNode from "../../nodes/NVNode";
import CVModel2 from "client/components/CVModel2";
////////////////////////////////////////////////////////////////////////////////

interface ITreeNode
{
    id: string;
    children: ITreeNode[];
    text: string;
    classes: string;
    property?: Property;
}

@customElement("sv-test-task-view")
export default class TestTaskView extends TaskView<CVTestTask>
{
     protected connected()
    {
        super.connected();
    }

    protected disconnected()
    {
        super.disconnected();
    }
    protected render()
    {
        let node = this.activeNode.components.get(CVModel2, true);
        if(!this.activeDocument) {
            return;
        }
        if(!node || !node.tags.has("iiif")) {
            return html`<div class="sv-placeholder">Please select a node with the "iiif" tag to display its properties.</div>`;
        }
        //TODO: This displays the settinsg tree, need to make a tree for manifest vars
        return html`<sv-settings-tree .node=${node}></sv-settings-tree>`;
    }

        protected createNodeTreeNode(node: CVModel2): ITreeNode
        {
            const components = node.components.getArray().filter(component => component["manifestProperties"]);
    
            return {
                id: node.id,
                text: node.displayName,
                classes: "ff-node",
                children: components.map(component => ({
                    id: component.id,
                    text: component.displayName,
                    classes: "ff-component",
                    property: null,
                    children: this.createPropertyNodes(component["manifestProperties"]),
                })),
            };
        }
        protected createPropertyNodes(properties: Property[]): ITreeNode[]
            {
                const root: Partial<ITreeNode> = {
                    children: []
                };
        
                properties.forEach(property => {
                    const fragments = property.path.split(".");
                    let node = root;
        
                    const count = fragments.length;
                    const last = count - 1;
        
                    for (let i = 0; i < count; ++i) {
                        const fragment = fragments[i];
                        let child = node.children.find(node => node.text === fragment);
        
                        if (!child) {
                            const id = i === last ? property.key : fragment;
        
                            child = {
                                id,
                                text: fragment,
                                classes: "",
                                children: [],
                                property: i === last ? property : null
                            };
                            node.children.push(child);
                        }
                        node = child;
                    }
                });
        
                return root.children;
            }
}