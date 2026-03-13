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

//http://localhost:3000/voyager-story-dev?model=https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb


import CVManifestTask from "../../components/CVManifestTask";
import Node from "@ff/graph/Node";
import Component from "@ff/graph/Component";
import Property from "@ff/graph/Property";

import "@ff/scene/ui/PropertyView";

import { customElement, property, html } from "@ff/ui/CustomElement";
import Tree from "@ff/ui/Tree";

import { TaskView } from "../../components/CVTask";
import NVNode from "../../nodes/NVNode";
import { IManifestProvider, ManifestProps, isManifestProvider } from "client/utils/ManifestProps";
////////////////////////////////////////////////////////////////////////////////

interface ITreeNode
{
    id: string;
    children: ITreeNode[];
    text: string;
    classes: string;
    property?: Property;
}

@customElement("sv-manifest-task-view")
export default class ManifestTaskView extends TaskView<CVManifestTask>
{
    /*protected connected()
    {
        super.connected();
    }

    protected disconnected()
    {
        super.disconnected();
    }*/
    protected render()
    {
        if(!this.activeDocument) {
            return;
        }
        const languageManager = this.activeDocument.setup.language;
        //const langSwitch = `<sv-property-view .property=${languageManager.ins.activeLanguage}></sv-property-view>`;
        const defMsg = html`<div class="sv-placeholder">Please select a node that implements IManifestProvider.</div>`;
        if(!this.activeNode) {
            return defMsg;
        }
        //Get only nodes with manifest properties
        const nodes = this.activeNode.components.getArray().filter(isManifestProvider);
        //console.log(`Nodes size: ${nodes.length}`);
        const node = nodes.length > 0 ? this.activeNode : null; //Need to pass the NVNode to the tree
        //Not a IIIF node
        if(!node) {
            return defMsg;
        }
        
        return html`<div class="ff-flex-item-stretch ff-scroll-y">
            <sv-manifest-tree .node=${node}></sv-manifest-tree>
        </div>`;
    }
    protected onActiveNode(previous: NVNode, next: NVNode)
    {
        this.requestUpdate();
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ITreeNode
{
    id: string;
    children: ITreeNode[];
    text: string;
    classes: string;
    property?: Property;
}

@customElement("sv-manifest-tree")
export class ManifestTree extends Tree<ITreeNode>
{
    @property({ attribute: false })
    node: NVNode = null;

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("ff-property-tree", "sv-manifest-tree");
    }

    protected getClasses(treeNode: ITreeNode)
    {
        return treeNode.classes;
    }

    protected update(changedProperties: Map<PropertyKey, unknown>)
    {
        if (changedProperties.has("node")) {
            this.root = this.createNodeTreeNode(this.node);
        }

        super.update(changedProperties);
    }

    protected renderNodeHeader(node: ITreeNode)
    {
        if (!node.property) {
            return html`<div class="ff-text ff-label ff-ellipsis">${node.text}</div>`;
        }

        return html`<sv-property-view .property=${node.property}></sv-property-view>`;

    }

    protected createNodeTreeNode(node: Node): ITreeNode
    {
        const components: (Component & IManifestProvider)[] = node.components.getArray().filter(isManifestProvider);

        return {
            id: node.id,
            text: node.displayName,
            classes: "ff-node",
            children: components.map(component => ({
                id: component.id,
                text: component.displayName,
                classes: "ff-component",
                property: null,
                children: this.createPropertyNodes(component.manifestProps),
            })),
        };
    }

    protected createPropertyNodes(properties: ManifestProps): ITreeNode[]
    {
        const root: Partial<ITreeNode> = {
            children: []
        };

        Object.entries(properties.all).forEach(([key, value]) => {
            let node = root;
            let child = node.children.find(node => node.text === key);
            let prop = properties.getProperty(key);
            //console.log(`Key: ${key}, Prop: ${prop}`);

            if (!child) {
                child = {
                    id: key,
                    text: key,
                    classes: "",
                    children: [],
                    property: prop //UI Property object
                };
                node.children.push(child);
            }
        });

        return root.children;
    }
}